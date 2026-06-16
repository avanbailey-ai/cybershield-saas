import { createHash } from 'crypto';
import type { ScanResult } from '@/lib/scanner/runScan';

/** Stable hash of scan state for cache keys — no AI involvement. */
export function computeScanHash(scan: ScanResult): string {
  const payload = JSON.stringify({
    score: scan.score,
    ssl: scan.ssl,
    headers: scan.headers,
    issues: [...scan.issues].sort(),
    scripts: [...scan.pageSnapshot.scripts].sort(),
    endpoints: [...scan.pageSnapshot.endpoints].sort(),
    loginForm: scan.pageSnapshot.loginFormDetected,
  });
  return createHash('sha256').update(payload).digest('hex').slice(0, 32);
}
