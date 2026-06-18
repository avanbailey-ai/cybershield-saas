import type { ScanResult } from './runScan';
import {
  executeScanWithTimeout,
  ScanTimeoutError,
} from './executeScanWithTimeout';

export { ScanTimeoutError };

/** @deprecated Prefer executeScanWithTimeout(url, scanKind). Defaults to deep scan. */
export async function runScanWithTimeout(url: string): Promise<ScanResult> {
  return executeScanWithTimeout(url, 'deep_scan');
}


