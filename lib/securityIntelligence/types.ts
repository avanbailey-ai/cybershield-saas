import type { ScanResult } from '@/lib/scanner/runScan';
import type { ScanSnapshot } from '@/lib/scanner/pageSnapshot';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type FindingCategory =
  | 'transport'
  | 'headers'
  | 'attack_surface'
  | 'authentication'
  | 'third_party';

export type AttackSurfaceLevel = 'Low' | 'Medium' | 'High' | 'Critical';

/** Enterprise-grade finding card — Snyk/Datadog-style structured intelligence. */
export interface SecurityIntelligenceCard {
  title: string;
  severity: Severity;
  category: FindingCategory;
  description: string;
  impact: string[];
  exploitScenario: string;
  fix: string;
  securityImpactIfFixed: string;
}

export interface SecurityFinding extends SecurityIntelligenceCard {
  id: string;
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
  attackSurfaceLevel: AttackSurfaceLevel;
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
