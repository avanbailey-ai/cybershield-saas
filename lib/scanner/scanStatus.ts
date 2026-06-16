/**
 * Scan status mapping — scans table is SSOT (pending/running/completed/failed).
 * UI display labels use queued/processing equivalents.
 */

export type ScanRecordStatus = 'pending' | 'running' | 'completed' | 'failed';

export type ScanDisplayStatus = 'queued' | 'processing' | 'completed' | 'failed';

export const SCAN_UI_TIMEOUT_MS = 120_000;
export const SCAN_LOCK_EXPIRE_MINUTES = 3;
export const STALE_RECLAIM_MINUTES = 10;

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
    return 'Scan is taking longer than expected…';
  }
  switch (display) {
    case 'queued':
      return 'Scan queued…';
    case 'processing':
      return 'Scanning in progress…';
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
