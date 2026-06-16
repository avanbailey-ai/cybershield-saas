import type { ScanResult } from '@/lib/scanner/runScan';

import type { SecurityFinding } from './types';

import { generateIntelligenceCards } from './intelligenceCards';



/** Deterministic enterprise findings from scan signals — no AI. */

export function generateFindings(scan: ScanResult): SecurityFinding[] {

  return generateIntelligenceCards(scan);

}

