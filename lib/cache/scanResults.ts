/** @deprecated Use lib/cache/scanCache — kept for backward compatibility. */
export {
  getCachedScan as getCachedScanResult,
  setCachedScan as setCachedScanResult,
  invalidateScan,
  normalizeDomain,
} from './scanCache';

import { normalizeDomain } from './scanCache';

export function scanCacheKey(url: string): string {
  return `scan:${normalizeDomain(url)}`;
}

export function pruneScanCache(): void {
  // no-op; scanCache self-prunes on read
}
