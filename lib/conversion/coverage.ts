/** UI-only: estimate how much of a scan report is visible on the free tier. */
export function computeSecurityCoverage(
  visibleIssues: number,
  totalIssues: number,
  options?: { includesScore?: boolean },
): number {
  const includesScore = options?.includesScore ?? true;
  const scoreWeight = includesScore ? 20 : 0;
  const issueWeight = 55;
  const summaryWeight = 5;

  const issueRatio =
    totalIssues > 0 ? Math.min(1, visibleIssues / totalIssues) : visibleIssues > 0 ? 1 : 0;

  const raw = scoreWeight + Math.round(issueRatio * issueWeight) + summaryWeight;
  return Math.min(75, Math.max(15, raw));
}
