import type { ScanResult } from '@/lib/scanner/runScan';
import type { ScanSnapshot } from '@/lib/scanner/pageSnapshot';
import { buildSnapshotFromScanResult } from '@/lib/scanner/pageSnapshot';
import { detectScanChanges } from '@/lib/scanner/diffDetection';
import type { ChangeSummary } from './types';

export interface ChangeDetectionInput {
  previousScan: {
    securityScore: number | null;
    issues: string[] | null;
    snapshot: ScanSnapshot | null;
  } | null;
  currentScan: ScanResult;
  detectedAt?: string;
}

/** Compare previous scan and summarize posture change — deterministic, no AI. */
export function detectSecurityChanges(input: ChangeDetectionInput): ChangeSummary {
  const { previousScan, currentScan, detectedAt = new Date().toISOString() } = input;
  const highlights: string[] = [];

  if (!previousScan) {
    return {
      posture: 'no_change',
      scoreDelta: null,
      highlights: ['First scan — baseline established'],
    };
  }

  const scoreDelta =
    previousScan.securityScore !== null
      ? currentScan.score - previousScan.securityScore
      : null;

  const prevIssues = new Set(previousScan.issues ?? []);
  const newIssues = currentScan.issues.filter((issue) => !prevIssues.has(issue));
  const resolvedIssues = (previousScan.issues ?? []).filter((issue) => !currentScan.issues.includes(issue));

  if (newIssues.length > 0) {
    highlights.push(`${newIssues.length} new issue(s) detected`);
  }
  if (resolvedIssues.length > 0) {
    highlights.push(`${resolvedIssues.length} issue(s) resolved`);
  }
  if (scoreDelta !== null && scoreDelta !== 0) {
    highlights.push(`Security score ${scoreDelta > 0 ? 'increased' : 'decreased'} by ${Math.abs(scoreDelta)} points`);
  }

  const currentSnapshot = buildSnapshotFromScanResult({
    ssl: currentScan.ssl,
    rawHeaders: currentScan.rawHeaders,
    pageSnapshot: currentScan.pageSnapshot,
  });

  const diff = detectScanChanges(previousScan.snapshot, currentSnapshot, detectedAt);
  const scriptChanges = diff.changes.filter((c) => c.type === 'script_added' || c.type === 'script_removed');
  const headerChanges = diff.changes.filter((c) => c.type === 'security_header_changed');
  const removedHeaders = headerChanges.filter((c) => c.description.includes('removed'));

  if (scriptChanges.length > 0) {
    highlights.push(`${scriptChanges.length} script change(s)`);
  }
  if (removedHeaders.length > 0) {
    highlights.push(`${removedHeaders.length} security header(s) removed`);
  }

  let posture: ChangeSummary['posture'] = 'no_change';
  if (scoreDelta !== null) {
    if (scoreDelta >= 5) posture = 'improved';
    else if (scoreDelta <= -5) posture = 'degraded';
  }
  if (posture === 'no_change' && newIssues.length > 0 && resolvedIssues.length === 0) {
    posture = 'degraded';
  }
  if (posture === 'no_change' && resolvedIssues.length > 0 && newIssues.length === 0) {
    posture = 'improved';
  }

  if (highlights.length === 0) {
    highlights.push('No significant changes since last scan');
  }

  return { posture, scoreDelta, highlights };
}
