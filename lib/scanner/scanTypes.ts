import type { PageSnapshotPartial } from './pageSnapshot';

export type ScanExecutionKind = 'monitoring_check' | 'deep_scan';

export const EMPTY_PAGE_SNAPSHOT: PageSnapshotPartial = {
  metaTags: {},
  scripts: [],
  loginFormDetected: false,
  endpoints: [],
  formsDetected: 0,
  thirdPartyScripts: [],
  externalApiCalls: [],
  techFingerprint: { frameworks: [], cdn: [], analytics: [] },
};

/** Change types detectable on lightweight monitoring ticks (headers + SSL only). */
export const LIGHTWEIGHT_CHANGE_TYPES = new Set([
  'security_header_changed',
  'ssl_changed',
]);

export function resolveScanExecutionKind(
  scanKind: string | null | undefined,
  scanSource?: string | null,
): ScanExecutionKind {
  if (scanKind === 'deep_scan' || scanKind === 'monitoring_check') {
    return scanKind;
  }
  return scanSource === 'cron' ? 'monitoring_check' : 'deep_scan';
}
