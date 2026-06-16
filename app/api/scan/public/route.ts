/**

 * POST /api/scan/public

 * Unauthenticated, stateless scan for the public /scan page and landing demo.

 * Returns truncated risk summary — full report requires paid dashboard scan.

 */



import { runScan } from '@/lib/scanner/runScan';

import { checkPublicScanLimit, recordPublicScanLimit } from '@/lib/conversion/serverLimits';

import { storeReport, extractDomain } from '@/lib/ai/storeReport';

import { updateLeaderboard } from '@/lib/leaderboard/update';

import { triggerPublicScanEmails } from '@/lib/email/funnel';

import { getCachedScan, setCachedScan, dedupeScan, normalizeDomain } from '@/lib/cache/scanCache';

import { rateLimitScan, rateLimitHeaders } from '@/lib/rateLimit/limiter';

import { emitEvent } from '@/lib/brain/eventBus';

import { logApiTiming, recordPerformanceEvent } from '@/lib/observability/log';

import { NextRequest, NextResponse } from 'next/server';



const FREE_ISSUE_LIMIT = 2;

const CACHE_TTL_MS = 10 * 60 * 1000;



interface PublicScanResponse {

  url: string;

  score: number;

  riskLevel: string;

  issues: unknown[];

  vulnerabilitiesCount: number;

  lockedIssuesCount: number;

  genericMessage: string;

  riskDetected: boolean;

  shareToken: string | null;

  cached?: boolean;

  aiReportStatus?: 'deterministic' | 'skipped' | 'cached';

}



function buildPublicResponse(
  result: Awaited<ReturnType<typeof runScan>>,
  requestUrl: string,
  shareToken: string | null,
  aiReportStatus?: 'deterministic' | 'skipped' | 'cached',
): PublicScanResponse {
  const totalIssues = result.issues.length;
  const truncatedIssues = result.issues.slice(0, FREE_ISSUE_LIMIT);
  const riskDetected = result.score < 60;
  const genericMessage = riskDetected
    ? 'Risk Detected — upgrade to see full details'
    : 'No major issues found — upgrade for continuous monitoring';

  const displayUrl =
    typeof result.url === 'string' && result.url.trim().length > 0
      ? result.url.trim()
      : requestUrl.trim();

  const issueStrings = truncatedIssues.map((issue) =>
    typeof issue === 'string' ? issue : String(issue),
  );

  const score =
    typeof result.score === 'number' && Number.isFinite(result.score) ? result.score : 0;

  return {
    url: displayUrl,
    score,
    riskLevel: result.riskLevel ?? 'medium',
    issues: issueStrings,
    vulnerabilitiesCount: totalIssues,
    lockedIssuesCount: Math.max(0, totalIssues - FREE_ISSUE_LIMIT),
    genericMessage,
    riskDetected,
    shareToken,
    aiReportStatus,
  };
}



export async function POST(req: NextRequest) {

  const start = Date.now();

  let body: { url?: string; email?: string };



  try {

    body = await req.json();

  } catch {

    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  }



  const sessionId = req.headers.get('x-scan-session-id');

  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  const rateCheck = rateLimitScan(clientIp, 'anonymous');

  if (!rateCheck.allowed) {

    logApiTiming('/api/scan/public', Date.now() - start, 429);

    return NextResponse.json(

      { error: 'Too many scan requests. Please wait before trying again.' },

      { status: 429, headers: rateLimitHeaders(rateCheck) },

    );

  }



  const { url, email } = body;

  if (!url || typeof url !== 'string') {

    return NextResponse.json({ error: 'url is required' }, { status: 400 });

  }



  try {

    new URL(url);

  } catch {

    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });

  }



  const limitCheck = checkPublicScanLimit(sessionId, clientIp, url);

  if (!limitCheck.allowed) {

    logApiTiming('/api/scan/public', Date.now() - start, 429, { reason: limitCheck.reason });

    return NextResponse.json(

      { error: limitCheck.message ?? 'Daily scan limit reached.' },

      { status: 429, headers: rateLimitHeaders(rateCheck) },

    );

  }



  const domain = normalizeDomain(url);

  const cached = getCachedScan<PublicScanResponse>(domain);

  if (cached) {
    const repaired: PublicScanResponse = {
      ...cached,
      url:
        typeof cached.url === 'string' && cached.url.trim().length > 0 && !cached.url.includes('undefined')
          ? cached.url
          : url.trim(),
      score:
        typeof cached.score === 'number' && Number.isFinite(cached.score) ? cached.score : 0,
      issues: Array.isArray(cached.issues)
        ? cached.issues.map((issue) => (typeof issue === 'string' ? issue : String(issue)))
        : [],
    };

    logApiTiming('/api/scan/public', Date.now() - start, 200, { cached: true, domain });

    return NextResponse.json(
      { ...repaired, cached: true },
      { headers: rateLimitHeaders(rateCheck) },
    );
  }



  try {

    const response = await dedupeScan(domain, async () => {

      const scanStart = Date.now();

      const result = await runScan(url);



      let shareToken: string | null = null;
      const aiReportStatus: 'deterministic' = 'deterministic';
      const reportParams = {
        scanId: null,
        domain: extractDomain(url),
        userId: null,
        scanResult: result,
        autoShare: true,
        websiteId: null,
        plan: 'free' as const,
      };

      try {
        const stored = await storeReport(reportParams);
        shareToken = stored?.shareToken ?? null;
      } catch (err) {
        console.error('[public-scan] Report storage failed:', err);
      }



      void updateLeaderboard(domain, result.score).catch((err) =>

        console.error('[public-scan] Leaderboard update failed:', err),

      );



      if (email && typeof email === 'string' && email.includes('@')) {

        void triggerPublicScanEmails({

          email,

          domain: extractDomain(url),

          score: result.score,

          reportSummary: result.explanation,

        }).catch((err) => console.error('[public-scan] Email funnel failed:', err));

      }



      const built = buildPublicResponse(result, url, shareToken, aiReportStatus);

      setCachedScan(domain, built, CACHE_TTL_MS);

      recordPublicScanLimit(sessionId!, clientIp, url);



      recordPerformanceEvent('public_scan_completed', {

        domain,

        durationMs: Date.now() - scanStart,

        score: result.score,

      });



      void emitEvent(

        'scan_completed',

        { domain, score: result.score, public: true },

        null,

        sessionId,

      );



      return built;

    });



    const durationMs = Date.now() - start;

    logApiTiming('/api/scan/public', durationMs, 200, { domain, cached: false });



    return NextResponse.json(response, { headers: rateLimitHeaders(rateCheck) });

  } catch (err) {

    console.error('[public-scan] failed:', err);

    return NextResponse.json({ error: 'Scan failed' }, { status: 500 });

  }

}

