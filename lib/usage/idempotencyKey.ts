import { createHash } from 'crypto';

/** Stable key for user+website within a time window — prevents double-click duplicates. */
export function buildScanIdempotencyKey(
  userId: string,
  websiteId: string,
  windowMinutes = 5,
): string {
  const window = Math.floor(Date.now() / (windowMinutes * 60 * 1000));
  const raw = `${userId}:${websiteId}:${window}`;
  return createHash('sha256').update(raw).digest('hex').slice(0, 32);
}
