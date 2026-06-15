/**
 * POST /api/scan/public
 * Unauthenticated, stateless scan for the public /scan page and landing demo.
 * Returns truncated risk summary — full report requires paid dashboard scan.
 */

import { runScan } from '@/lib/scanner/runScan';
import { checkAndIncrementServerScanLimit } from '@/lib/conversion/serverLimits';
import { MAX_PUBLIC_SCANS_PER_DAY } from '@/lib/conversion/limits';
import { generateAndStoreReport, extractDomain } from '@/lib/ai/storeReport';
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
}

function buildPublicResponse(
  result: Awaited<ReturnType<typeof runScan>>,
  shareToken: string | null,
): PublicScanResponse {
  const totalIssues = result.issues.length;
  const truncatedIssues = result.issues.slice(0, FREE_ISSUE_LIMIT);
  const riskDetected = result.score < 60;
  const genericMessage = riskDetected
    ? 'Risk Detected — upgrade to see full details'
    : 'No major issues found — upgrade for continuous monitoring';

  return {
    url: result.url,
    score: result.score,
    riskLevel: result.riskLevel,
    issues: truncatedIssues,
    vulnerabilitiesCount: totalIssues,
    lockedIssuesCount: Math.max(0, totalIssues - FREE_ISSUE_LIMIT),
    genericMessage,
    riskDetected,
    shareToken,
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
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? sessionId ?? 'anon';
  const rateCheck = rateLimitScan(clientIp, 'anonymous');
  if (!rateCheck.allowed) {
    logApiTiming('/api/scan/public', Date.now() - start, 429);
    return NextResponse.json(
      { error: 'Too many scan requests. Please wait before trying again.' },
      { status: 429, headers: rateLimitHeaders(rateCheck) },
    );
  }

  const { allowed } = checkAndIncrementServerScanLimit(sessionId);
  if (!allowed) {
    return NextResponse.json(
      {
        error: `Daily scan limit reached (${MAX_PUBLIC_SCANS_PER_DAY}/day). Upgrade for unlimited monitoring.`,
      },
      { status: 429 },
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

  const domain = normalizeDomain(url);
  const cached = getCachedScan<PublicScanResponse>(domain);
  if (cached) {
    logApiTiming('/api/scan/public', Date.now() - start, 200, { cached: true, domain });
    return NextResponse.json(
      { ...cached, cached: true },
      { headers: rateLimitHeaders(rateCheck) },
    );
  }

  try {
    const response = await dedupeScan(domain, async () => {
      const scanStart = Date.now();
      const result = await runScan(url);

      let shareToken: string | null = null;
      try {
        const stored = await generateAndStoreReport({
          scanId: null,
          domain: extractDomain(url),
          userId: null,
          scanResult: result,
          autoShare: true,
        });
        shareToken = stored?.shareToken ?? null;
      } catch (err) {
        console.error('[public-scan] Report generation failed:', err);
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

      const built = buildPublicResponse(result, shareToken);
      setCachedScan(domain, built, CACHE_TTL_MS);

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
