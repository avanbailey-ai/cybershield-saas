export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type Score = number;

export interface HeaderChecks {
  csp: boolean;
  hsts: boolean;
  xFrame: boolean;
  xContentType: boolean;
  referrerPolicy: boolean;
  permissionsPolicy: boolean;
}

export interface ScanResultShape {
  url: string;
  score: Score;
  riskLevel: RiskLevel;
  issues: string[];
  headers?: HeaderChecks;
  ssl?: boolean;
  passed?: string[];
  explanation?: string;
  error?: string;
}
