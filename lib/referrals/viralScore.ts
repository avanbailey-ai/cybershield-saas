export interface ViralStats {
  shares: number;
  referrals: number;
  conversions: number;
}

/** shares×2 + referrals×5 + conversions×10 */
export function computeViralScore(stats: ViralStats): number {
  return stats.shares * 2 + stats.referrals * 5 + stats.conversions * 10;
}
