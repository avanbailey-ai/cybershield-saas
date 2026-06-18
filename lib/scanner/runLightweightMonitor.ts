import dns from 'node:dns/promises';
import { applyIntelligenceToScanResult } from '@/lib/securityIntelligence/engine';
import type { ScanResult } from './runScan';
import { EMPTY_PAGE_SNAPSHOT } from './scanTypes';

export interface LightweightMonitorMeta {
  httpStatus: number | null;
  dnsResolved: boolean;
  dnsAddresses: string[];
  responseTimeMs: number;
}

export type LightweightScanResult = ScanResult & {
  monitoringMeta: LightweightMonitorMeta;
};

function assertWorkerContext(caller: string): void {
  const stack = new Error().stack ?? '';
  if (!stack.includes('processQueue') && !stack.includes('executeScanWithTimeout')) {
    console.warn(
      `[SECURITY] ${caller} called outside worker context.`,
      '\nCall stack:',
      stack,
    );
  }
}

function hostnameFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** Frequent monitoring path — HEAD + DNS only; no HTML parse or AI. */
export async function runLightweightMonitor(url: string): Promise<LightweightScanResult> {
  assertWorkerContext('runLightweightMonitor');
  const started = Date.now();
  console.log(`[LIGHTWEIGHT SCAN] ${new Date().toISOString()} — ${url}`);

  const ssl = url.toLowerCase().startsWith('https://');
  let rawHeaders: Record<string, string> = {};
  let httpStatus: number | null = null;
  let dnsResolved = false;
  let dnsAddresses: string[] = [];

  const host = hostnameFromUrl(url);
  if (host) {
    try {
      const lookup = await dns.lookup(host, { all: true });
      dnsAddresses = lookup.map((entry) => entry.address);
      dnsResolved = dnsAddresses.length > 0;
    } catch {
      dnsResolved = false;
    }
  }

  if (!dnsResolved) {
    const message = host ? `DNS resolution failed for ${host}` : 'Invalid URL';
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
      pageSnapshot: { ...EMPTY_PAGE_SNAPSHOT },
      score: 0,
      riskLevel: 'critical',
      issues: [message],
      passed: [],
      explanation: `Monitoring check failed: ${message}`,
      error: message,
      monitoringMeta: {
        httpStatus: null,
        dnsResolved: false,
        dnsAddresses: [],
        responseTimeMs: Date.now() - started,
      },
    };
  }

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'CyberShield-Monitor/1.0' },
    });
    httpStatus = response.status;
    rawHeaders = Object.fromEntries(response.headers.entries());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const base: LightweightScanResult = {
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
      pageSnapshot: { ...EMPTY_PAGE_SNAPSHOT },
      score: 0,
      riskLevel: 'critical',
      issues: [`Site unreachable: ${message}`],
      passed: [],
      explanation: `Monitoring check failed: ${message}`,
      error: message,
      monitoringMeta: {
        httpStatus: null,
        dnsResolved: true,
        dnsAddresses,
        responseTimeMs: Date.now() - started,
      },
    };
    return applyIntelligenceToScanResult(base) as LightweightScanResult;
  }

  const h = rawHeaders;
  const issues: string[] = [];
  if (httpStatus !== null && httpStatus >= 500) {
    issues.push(`Server error HTTP ${httpStatus}`);
  } else if (httpStatus !== null && httpStatus >= 400) {
    issues.push(`Client error HTTP ${httpStatus}`);
  }

  const rawResult: LightweightScanResult = {
    url,
    ssl: ssl && httpStatus !== null && httpStatus < 500,
    headers: {
      csp: !!h['content-security-policy'],
      hsts: !!h['strict-transport-security'],
      xFrame: !!h['x-frame-options'],
      xContentType: !!h['x-content-type-options'],
      referrerPolicy: !!h['referrer-policy'],
      permissionsPolicy: !!h['permissions-policy'],
    },
    rawHeaders,
    pageSnapshot: { ...EMPTY_PAGE_SNAPSHOT },
    score: 100,
    riskLevel: 'low',
    issues,
    passed: [],
    explanation: '',
    monitoringMeta: {
      httpStatus,
      dnsResolved: true,
      dnsAddresses,
      responseTimeMs: Date.now() - started,
    },
  };

  const scored = applyIntelligenceToScanResult(rawResult) as LightweightScanResult;
  return { ...scored, monitoringMeta: rawResult.monitoringMeta };
}
