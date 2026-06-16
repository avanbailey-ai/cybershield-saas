export type ConversionTier = 'pro' | 'smb_urgency' | 'enterprise_escalation';

export type FunnelSegment = 'smb' | 'enterprise';

export type RecommendedPlan = 'pro' | 'growth';

export interface ScanFunnelInput {
  score: number;
  riskLevel?: string;
  issues: string[];
  vulnerabilitiesCount: number;
  domain?: string;
  /** Prior score for same domain — used to detect repeated no-improvement. */
  priorScore?: number | null;
}

export interface ScanFunnelResult {
  segment: FunnelSegment;
  conversionTier: ConversionTier;
  /** Show secondary enterprise opt-in block (score < 60, high findings, compliance). */
  showEnterpriseCta: boolean;
  /** Show "Security Review Recommended" escalation to /enterprise/review. */
  showEnterpriseReview: boolean;
  smbPrimaryCta: string;
  smbPrimaryHref: string;
  recommendedPlan: RecommendedPlan;
  enterpriseHref: string;
  topIssuesCount: number;
  /** Human-readable triggers for analytics/debug. */
  triggers: string[];
}
