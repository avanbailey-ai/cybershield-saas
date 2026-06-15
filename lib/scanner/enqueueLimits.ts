/** Enqueue rate/cooldown constants and helpers — no DB or billing imports. */

export const SCAN_COOLDOWN_MS = 10 * 60 * 1000;
export const RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const RATE_LIMIT_MAX_SCANS = 25;

export function cooldownRemainingMs(lastScannedAt: string | null | undefined): number {
  if (!lastScannedAt) return 0;
  const elapsed = Date.now() - new Date(lastScannedAt).getTime();
  return Math.max(0, SCAN_COOLDOWN_MS - elapsed);
}

export function isWithinCooldown(lastScannedAt: string | null | undefined): boolean {
  return cooldownRemainingMs(lastScannedAt) > 0;
}
