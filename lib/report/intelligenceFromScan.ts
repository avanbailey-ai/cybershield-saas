import type { ScanResult, HeaderChecks } from '@/lib/scanner/runScan';
import type { PageSnapshotPartial } from '@/lib/scanner/pageSnapshot';
import { buildSnapshotFromDbRow, enrichPageSnapshotPartial } from '@/lib/scanner/pageSnapshot';
import {
  runSecurityIntelligence,
  type SecurityIntelligenceReport,
} from '@/lib/securityIntelligence/engine';

const EMPTY_HEADERS: HeaderChecks = {
  csp: false,
  hsts: false,
  xFrame: false,
  xContentType: false,
  referrerPolicy: false,
  permissionsPolicy: false,
};

const EMPTY_PAGE_SNAPSHOT: PageSnapshotPartial = {
  metaTags: {},
  scripts: [],
  loginFormDetected: false,
  endpoints: [],
  formsDetected: 0,
  thirdPartyScripts: [],
  externalApiCalls: [],
  techFingerprint: { frameworks: [], cdn: [], analytics: [] },
};

export interface PersistedScanRow {
  security_score: number | null;
  risk_level: ScanResult['riskLevel'] | null;
  ssl_valid: boolean | null;
  headers: HeaderChecks | null;
  issues: string[] | null;
  passed: string[] | null;
  explanation: string | null;
  scan_snapshot: unknown;
}

export interface PreviousScanContext {
  security_score: number | null;
  issues: string[] | null;
  scan_snapshot: unknown;
  ssl_valid?: boolean | null;
  headers?: unknown;
}

function pageSnapshotFromDb(scanSnapshot: unknown): PageSnapshotPartial {
  if (!scanSnapshot || typeof scanSnapshot !== 'object') {
    return { ...EMPTY_PAGE_SNAPSHOT };
  }

  const snap = scanSnapshot as Record<string, unknown>;
  return {
    metaTags: (snap.metaTags as Record<string, string>) ?? {},
    scripts: Array.isArray(snap.scripts) ? (snap.scripts as string[]) : [],
    loginFormDetected: Boolean(snap.loginFormDetected),
    endpoints: Array.isArray(snap.endpoints) ? (snap.endpoints as string[]) : [],
    formsDetected: typeof snap.formsDetected === 'number' ? snap.formsDetected : 0,
    thirdPartyScripts: Array.isArray(snap.thirdPartyScripts)
      ? (snap.thirdPartyScripts as string[])
      : [],
    externalApiCalls: Array.isArray(snap.externalApiCalls)
      ? (snap.externalApiCalls as string[])
      : [],
    techFingerprint:
      snap.techFingerprint && typeof snap.techFingerprint === 'object'
        ? (snap.techFingerprint as PageSnapshotPartial['techFingerprint'])
        : { frameworks: [], cdn: [], analytics: [] },
  };
}

/** Reconstruct ScanResult from a persisted scans row for intelligence rendering. */
export function buildScanResultFromRow(url: string, row: PersistedScanRow): ScanResult {
  const headers = row.headers ?? EMPTY_HEADERS;
  const snapshot = buildSnapshotFromDbRow({
    ssl_valid: row.ssl_valid,
    headers,
    scan_snapshot: row.scan_snapshot,
  });

  const pageSnapshot = enrichPageSnapshotPartial(
    pageSnapshotFromDb(row.scan_snapshot),
    url,
  );
  if (snapshot) {
    pageSnapshot.metaTags = snapshot.metaTags;
    pageSnapshot.scripts = snapshot.scripts;
    pageSnapshot.loginFormDetected = snapshot.loginFormDetected;
    pageSnapshot.endpoints = snapshot.endpoints;
  }

  return {
    url,
    ssl: row.ssl_valid ?? false,
    headers,
    rawHeaders: snapshot?.securityHeaders ?? {},
    pageSnapshot,
    score: row.security_score ?? 0,
    riskLevel: row.risk_level ?? 'medium',
    issues: row.issues ?? [],
    passed: row.passed ?? [],
    explanation: row.explanation ?? '',
  };
}

/** Build enterprise intelligence report from persisted scan data. */
export function buildIntelligenceReport(
  url: string,
  row: PersistedScanRow,
  previousScan?: PreviousScanContext | null,
): SecurityIntelligenceReport {
  const scanResult = buildScanResultFromRow(url, row);

  const previous = previousScan
    ? {
        securityScore: previousScan.security_score,
        issues: previousScan.issues,
        snapshot: buildSnapshotFromDbRow({
          ssl_valid: previousScan.ssl_valid ?? null,
          headers: previousScan.headers ?? null,
          scan_snapshot: previousScan.scan_snapshot,
        }),
      }
    : null;

  return runSecurityIntelligence({ scanResult, previousScan: previous });
}
