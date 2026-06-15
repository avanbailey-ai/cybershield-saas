import { runScan, type ScanResult } from './runScan';

import { getScanJobTimeoutMs } from '@/lib/queue/constants';



export class ScanTimeoutError extends Error {

  constructor(timeoutMs: number) {

    super(`Scan timed out after ${timeoutMs}ms`);

    this.name = 'ScanTimeoutError';

  }

}



export async function runScanWithTimeout(

  url: string,

  timeoutMs = getScanJobTimeoutMs(),

): Promise<ScanResult> {

  let timer: ReturnType<typeof setTimeout> | undefined;



  try {

    return await Promise.race([

      runScan(url),

      new Promise<ScanResult>((_, reject) => {

        timer = setTimeout(() => reject(new ScanTimeoutError(timeoutMs)), timeoutMs);

      }),

    ]);

  } finally {

    if (timer) clearTimeout(timer);

  }

}


