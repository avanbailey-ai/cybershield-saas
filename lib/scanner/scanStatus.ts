/**
 * Scan status mapping — scans table is SSOT (pending/running/completed/failed).
 * UI display labels use queued/processing equivalents.
 */

export type ScanRecordStatus = 'pending' | 'running' | 'completed' | 'failed';

export type ScanDisplayStatus = 'queued' | 'processing' | 'completed' | 'failed';

export const SCAN_UI_TIMEOUT_MS = 180_000;
export const SCAN_LOCK_EXPIRE_MINUTES = 3;
export const STALE_RECLAIM_MINUTES = 10;
export const SCAN_TIMEOUT_HINT = 'Scans can take up to 3 minutes';
export const SCAN_DELAYED_LABEL = 'Scan delayed';
export const SCAN_DELAYED_MESSAGE =
  'Scan took longer than expected (over 3 min). The queue may still finish — retry if no result appears.';

export function mapScanStatusToDisplay(status: string): ScanDisplayStatus {
  switch (status) {
    case 'pending':
      return 'queued';
    case 'running':
      return 'processing';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    default:
      return 'failed';
  }
}

export function isActiveScanStatus(status: string): boolean {
  return status === 'pending' || status === 'running';
}

export function scanStatusLabel(status: string, timedOut = false): string {
  const display = mapScanStatusToDisplay(status);
  if (timedOut && (status === 'pending' || status === 'running')) {
    return SCAN_DELAYED_LABEL;
  }
  switch (display) {
    case 'queued':
      return 'Queued — waiting for worker…';
    case 'processing':
      return 'Scanning — may take up to 3 min…';
    case 'completed':
      return 'Scan complete';
    case 'failed':
      return 'Scan failed';
    default:
      return 'Scan failed';
  }
}

export function isScanStale(startedAt: string, timeoutMs = SCAN_UI_TIMEOUT_MS): boolean {
  return Date.now() - new Date(startedAt).getTime() > timeoutMs;
}
