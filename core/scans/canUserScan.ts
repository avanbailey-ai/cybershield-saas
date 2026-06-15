/**
 * Pure: given plan limits and current usage, can user run a scan?
 */
export function canUserScan(params: {
  planWebsiteLimit: number | null;
  currentWebsiteCount: number;
  isOrgActive: boolean;
}): { allowed: boolean; reason?: string } {
  const { planWebsiteLimit, currentWebsiteCount, isOrgActive } = params;

  if (!isOrgActive) {
    return { allowed: false, reason: 'Organization is suspended' };
  }

  if (currentWebsiteCount === 0) {
    return { allowed: false, reason: 'Add a website before running a scan' };
  }

  if (
    planWebsiteLimit !== null &&
    planWebsiteLimit !== Infinity &&
    currentWebsiteCount > planWebsiteLimit
  ) {
    return {
      allowed: false,
      reason: `Website count (${currentWebsiteCount}) exceeds plan limit (${planWebsiteLimit})`,
    };
  }

  return { allowed: true };
}
