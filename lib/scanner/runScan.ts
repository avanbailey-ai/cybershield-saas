import { parseHtmlSnapshot, type PageSnapshotPartial } from './pageSnapshot';
import { applyIntelligenceToScanResult } from '@/lib/securityIntelligence/engine';

export interface HeaderChecks {
  csp: boolean;
  hsts: boolean;
  xFrame: boolean;
  xContentType: boolean;
  referrerPolicy: boolean;
  permissionsPolicy: boolean;
}

export interface ScanResult {
  url: string;
  ssl: boolean;
  headers: HeaderChecks;
  rawHeaders: Record<string, string>;
  pageSnapshot: PageSnapshotPartial;
  score: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  issues: string[];
  passed: string[];
  explanation: string;
  error?: string;
}

const EMPTY_SNAPSHOT: PageSnapshotPartial = {
  metaTags: {},
  scripts: [],
  loginFormDetected: false,
  endpoints: [],
  formsDetected: 0,
  thirdPartyScripts: [],
  externalApiCalls: [],
  techFingerprint: { frameworks: [], cdn: [], analytics: [] },
};

export async function runScan(url: string): Promise<ScanResult> {
  const stack = new Error().stack ?? '';
  if (!stack.includes('processQueue')) {
    console.warn(
      '[SECURITY] runScan called outside worker context. This should only be called by processQueue.ts.',
      '\nCall stack:', stack,
    );
  }

  console.log(`[SCAN ENTRY] ${new Date().toISOString()} — starting scan for ${url}`);

  let rawHeaders: Record<string, string> = {};
  let pageSnapshot: PageSnapshotPartial = { ...EMPTY_SNAPSHOT };

  const ssl = url.toLowerCase().startsWith('https://');

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    });

    rawHeaders = Object.fromEntries(response.headers.entries());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      url,
      ssl: false,
      headers: {
        csp: false,
        hsts: false,
        xFrame: false,
        xContentType: false,
        referrerPolicy: false,
        permissionsPolicy: false,
      },
      rawHeaders: {},
      pageSnapshot: EMPTY_SNAPSHOT,
      score: 0,
      riskLevel: 'critical',
      issues: [`Could not reach website: ${message}`],
      passed: [],
      explanation: `Scan failed: ${message}`,
      error: message,
    };
  }

  try {
    const htmlResponse = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'CyberShield-Scanner/1.0' },
    });
    if (htmlResponse.ok) {
      const html = await htmlResponse.text();
      pageSnapshot = parseHtmlSnapshot(html, url);
    }
  } catch {
    // HTML fetch is best-effort; header-based scan still succeeds.
  }

  const h = rawHeaders;
  const hasCsp = !!h['content-security-policy'];
  const hasHsts = !!h['strict-transport-security'];
  const hasXFrame = !!h['x-frame-options'];
  const hasXContentType = !!h['x-content-type-options'];
  const hasReferrer = !!h['referrer-policy'];
  const hasPermissions = !!h['permissions-policy'];

  const rawResult: ScanResult = {
    url,
    ssl,
    headers: {
      csp: hasCsp,
      hsts: hasHsts,
      xFrame: hasXFrame,
      xContentType: hasXContentType,
      referrerPolicy: hasReferrer,
      permissionsPolicy: hasPermissions,
    },
    rawHeaders,
    pageSnapshot,
    score: 100,
    riskLevel: 'low',
    issues: [],
    passed: [],
    explanation: '',
  };

  return applyIntelligenceToScanResult(rawResult);
}
