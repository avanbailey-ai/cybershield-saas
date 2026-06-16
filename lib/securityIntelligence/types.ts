import type { ScanResult } from '@/lib/scanner/runScan';
import type { ScanSnapshot } from '@/lib/scanner/pageSnapshot';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface SecurityFinding {
  id: string;
  title: string;
  severity: Severity;
  explanation: string;
}

export interface SecurityRecommendation {
  findingId: string;
  title: string;
  steps: string[];
}

export interface ChangeSummary {
  posture: 'improved' | 'degraded' | 'no_change';
  scoreDelta: number | null;
  highlights: string[];
}

export interface SecurityIntelligenceReport {
  summary: string;
  riskLevel: ScanResult['riskLevel'];
  securityScore: number;
  attackSurfaceScore: number;
  findings: SecurityFinding[];
  recommendations: SecurityRecommendation[];
  changeSummary: ChangeSummary;
}

export interface EngineInput {
  scanResult: ScanResult;
  previousScan?: {
    securityScore: number | null;
    issues: string[] | null;
    snapshot: ScanSnapshot | null;
  } | null;
}
