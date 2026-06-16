import type { PostureState } from './postureState';

export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';

export type TrendDirection = 'improving' | 'degrading' | 'stable';

export interface SecurityNarrative {
  executive_summary: string;
  risk_story: string;
  key_events: string[];
  business_impact: string;
  recommended_actions: string[];
  urgency_level: UrgencyLevel;
}

export interface OrgSecurityNarrative {
  org_risk_overview: string;
  trend_summary: string;
  trend_direction: TrendDirection;
  active_threats_summary: string;
  posture_explanation: string;
}

export interface StoredSecurityNarrative {
  scan_id: string;
  org_id: string;
  narrative: SecurityNarrative;
  generated_at: string;
}
