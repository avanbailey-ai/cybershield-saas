import type { ScanResult } from '@/lib/scanner/runScan';
import type { ScanSnapshot } from '@/lib/scanner/pageSnapshot';
import { buildSnapshotFromScanResult } from '@/lib/scanner/pageSnapshot';
import { detectScanChanges } from '@/lib/scanner/diffDetection';

export interface AiChangeSignal {
  changeDetected: boolean;
  reasons: string[];
  scoreDelta: number | null;
  newVulnerabilities: string[];
  scriptChanges: boolean;
  headerChanges: boolean;
  domChanges: boolean;
}

export interface ChangeDetectionInput {
  previousScan: {
    securityScore: number | null;
    issues: string[] | null;
    snapshot: ScanSnapshot | null;
  } | null;
  currentScan: ScanResult;
  detectedAt?: string;
}

/** Detect meaningful changes that may warrant an AI report refresh. */
export function detectAiRelevantChanges(input: ChangeDetectionInput): AiChangeSignal {
  const { previousScan, currentScan, detectedAt = new Date().toISOString() } = input;
  const reasons: string[] = [];
  let changeDetected = false;

  if (!previousScan) {
    return {
      changeDetected: true,
      reasons: ['first_scan_baseline'],
      scoreDelta: null,
      newVulnerabilities: currentScan.issues,
      scriptChanges: currentScan.pageSnapshot.scripts.length > 0,
      headerChanges: Object.values(currentScan.headers).some((v) => !v),
      domChanges: currentScan.pageSnapshot.loginFormDetected,
    };
  }

  const prevIssues = new Set(previousScan.issues ?? []);
  const newVulnerabilities = currentScan.issues.filter((issue) => !prevIssues.has(issue));
  if (newVulnerabilities.length > 0) {
    changeDetected = true;
    reasons.push(`new_vulnerabilities:${newVulnerabilities.length}`);
  }

  const scoreDelta =
    previousScan.securityScore !== null
      ? currentScan.score - previousScan.securityScore
      : null;
  if (scoreDelta !== null && Math.abs(scoreDelta) >= 5) {
    changeDetected = true;
    reasons.push(`score_change:${scoreDelta > 0 ? '+' : ''}${scoreDelta}`);
  }

  const currentSnapshot = buildSnapshotFromScanResult({
    ssl: currentScan.ssl,
    rawHeaders: currentScan.rawHeaders,
    pageSnapshot: currentScan.pageSnapshot,
  });

  const diff = detectScanChanges(previousScan.snapshot, currentSnapshot, detectedAt);
  const scriptChanges = diff.changes.some(
    (c) => c.type === 'script_added' || c.type === 'script_removed',
  );
  const headerChanges = diff.changes.some((c) => c.type === 'security_header_changed');
  const domChanges = diff.changes.some(
    (c) =>
      c.type === 'login_form_changed' ||
      c.type === 'meta_tag_changed' ||
      c.type === 'endpoint_added' ||
      c.type === 'endpoint_removed',
  );

  if (scriptChanges) {
    changeDetected = true;
    reasons.push('script_dom_change');
  }
  if (headerChanges) {
    changeDetected = true;
    reasons.push('header_change');
  }
  if (domChanges) {
    changeDetected = true;
    reasons.push('dom_change');
  }

  return {
    changeDetected,
    reasons,
    scoreDelta,
    newVulnerabilities,
    scriptChanges,
    headerChanges,
    domChanges,
  };
}
