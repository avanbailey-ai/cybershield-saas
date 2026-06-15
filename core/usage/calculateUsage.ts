/**
 * Pure usage calculation from counts and plan limit.
 */
export function calculateUsage(params: {
  websiteCount: number;
  scanCount: number;
  alertCount: number;
  planLimit: number | null;
}): {
  websitesUsed: number;
  websitesLimit: number | null;
  percentUsed: number | null;
  atLimit: boolean;
} {
  const { websiteCount, planLimit } = params;
  const websitesUsed = websiteCount;
  const websitesLimit = planLimit;

  let percentUsed: number | null = null;
  if (websitesLimit !== null && websitesLimit > 0) {
    percentUsed = Math.min(100, Math.round((websitesUsed / websitesLimit) * 100));
  }

  const atLimit =
    websitesLimit !== null && websitesLimit !== Infinity && websitesUsed >= websitesLimit;

  return {
    websitesUsed,
    websitesLimit,
    percentUsed,
    atLimit,
  };
}
