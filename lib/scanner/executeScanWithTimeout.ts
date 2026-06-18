import { getLightweightScanTimeoutMs, getScanJobTimeoutMs } from '@/lib/queue/constants';
import { runLightweightMonitor } from './runLightweightMonitor';
import { runScan } from './runScan';
import type { ScanResult } from './runScan';
import type { ScanExecutionKind } from './scanTypes';

export class ScanTimeoutError extends Error {
  constructor(timeoutMs: number, kind: ScanExecutionKind) {
    super(`${kind} timed out after ${timeoutMs}ms`);
    this.name = 'ScanTimeoutError';
  }
}

async function withTimeout<T>(
  kind: ScanExecutionKind,
  timeoutMs: number,
  run: () => Promise<T>,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      run(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new ScanTimeoutError(timeoutMs, kind)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Route to lightweight monitor or full deep scan based on scan_kind. */
export async function executeScanWithTimeout(
  url: string,
  scanKind: ScanExecutionKind,
): Promise<ScanResult> {
  const timeoutMs =
    scanKind === 'monitoring_check' ? getLightweightScanTimeoutMs() : getScanJobTimeoutMs();

  if (scanKind === 'monitoring_check') {
    return withTimeout(scanKind, timeoutMs, () => runLightweightMonitor(url));
  }

  return withTimeout(scanKind, timeoutMs, () => runScan(url));
}
