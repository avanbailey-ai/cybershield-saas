/** Finding diff between consecutive scans for the same website — scans SSOT. */

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low';

export type ScanFindingRow = {
  id: string;
  website_id: string;
  security_score: number | null;
  issues: unknown;
  completed_at: string | null;
};

export interface ScanFindingDiff {
  added: string[];
  removed: string[];
  escalated: string[];
}

const CRITICAL_PATTERNS = [
  /no https/i,
  /plaintext/i,
  /could not reach/i,
  /scan failed/i,
  /ssl/i,
];

const HIGH_PATTERNS = [
  /missing content-security-policy/i,
  /missing strict-transport-security/i,
  /missing x-frame-options/i,
  /missing x-content-type-options/i,
  /missing referrer-policy/i,
  /missing permissions-policy/i,
  /login form/i,
  /third.?party script/i,
];

export function normalizeIssues(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string');
}

/** Classify legacy string issues into severity buckets. */
export function classifyIssueSeverity(issue: string): FindingSeverity {
  if (CRITICAL_PATTERNS.some((pattern) => pattern.test(issue))) return 'critical';
  if (HIGH_PATTERNS.some((pattern) => pattern.test(issue))) return 'high';
  if (/missing/i.test(issue)) return 'high';
  return 'medium';
}

export function isHighOrCriticalSeverity(severity: FindingSeverity): boolean {
  return severity === 'critical' || severity === 'high';
}

/** Compare current scan findings vs previous scan for the same website. */
export function diffScanFindings(
  previous: ScanFindingRow | null,
  current: ScanFindingRow,
): ScanFindingDiff {
  const prevIssues = normalizeIssues(previous?.issues);
  const currIssues = normalizeIssues(current.issues);
  const prevSet = new Set(prevIssues);

  const added = currIssues.filter((issue) => !prevSet.has(issue));
  const currSet = new Set(currIssues);
  const removed = prevIssues.filter((issue) => !currSet.has(issue));

  const escalated = added.filter((issue) =>
    isHighOrCriticalSeverity(classifyIssueSeverity(issue)),
  );

  return { added, removed, escalated };
}
