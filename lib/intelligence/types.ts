import type { FindingCategory, Severity } from '@/lib/securityIntelligence/types';

export type UrgencyLevel = 'immediate' | 'soon' | 'planned' | 'informational';
export type FixDifficulty = 'easy' | 'medium' | 'hard';

/** Deterministic explainer for a security or operational finding. */
export interface FindingExplainer {
  id: string;
  title: string;
  plainEnglish: string;
  businessImpact: string;
  technicalExplanation: string;
  recommendedNextStep: string;
  developerMessage: string;
  ownerAction: string;
  urgency: UrgencyLevel;
  difficulty: FixDifficulty;
  severity: Severity;
  category: FindingCategory;
}

export interface FixThisFirstItem {
  rank: number;
  id: string;
  title: string;
  whyItMatters: string;
  difficulty: FixDifficulty;
  ownerAction: string;
  developerAction: string;
  urgency: UrgencyLevel;
  severity: Severity;
}

export interface FixThisFirstResult {
  items: FixThisFirstItem[];
  summary: string;
}

export interface CustomerIntelligenceReport {
  executiveSummary: string;
  healthStatement: string;
  changesSinceLastScan: string;
  fixThisFirst: FixThisFirstResult;
  findingExplanations: FindingExplainer[];
  developerHandoff: string;
  monitoringValue: string;
  upgradeReason: string | null;
  generatedAt: string;
}

export interface AgencyClientReport {
  clientSummary: string;
  monthlyReport: string;
  proofOfWork: string;
  changesThisMonth: string;
  fixThisFirst: FixThisFirstResult;
  technicalAppendix: string;
  clientNextSteps: string;
  generatedAt: string;
}

export interface FounderRecommendation {
  id: string;
  title: string;
  why: string;
  action: string;
  section: 'inbox' | 'prospects' | 'success' | 'settings';
  dataSource: string;
}

export interface FounderIntelligenceSnapshot {
  todaysPriorities: FounderRecommendation[];
  bestSmbLead: { name: string; why: string; dataSource: string } | null;
  bestAgencyLead: { name: string; why: string; dataSource: string } | null;
  followUpsDue: number;
  blockedRevenueItems: string[];
  warnings: string[];
  nextBestAction: string;
  dataMissing: string[];
}

export interface PrioritizationInput {
  findings: Array<{
    id: string;
    title: string;
    severity: Severity;
    category: FindingCategory;
  }>;
  sslValid?: boolean | null;
  sslDaysUntilExpiry?: number | null;
  domainDaysUntilExpiry?: number | null;
  siteReachable?: boolean;
  uptimeIssue?: boolean;
  unexpectedChange?: boolean;
  changedScripts?: boolean;
  changedHeaders?: boolean;
  mixedContent?: boolean;
  planLevel?: 'free' | 'pro' | 'growth' | 'agency' | 'enterprise';
  websiteType?: string;
}
