export type LeadScore = 'HOT' | 'WARM' | 'LOW';

export type CrmStage =
  | 'new_lead'
  | 'contacted'
  | 'replied'
  | 'demo'
  | 'trial'
  | 'customer'
  | 'lost';

export const CRM_STAGES: { id: CrmStage; label: string }[] = [
  { id: 'new_lead', label: 'New Lead' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'replied', label: 'Replied' },
  { id: 'demo', label: 'Demo' },
  { id: 'trial', label: 'Trial' },
  { id: 'customer', label: 'Customer' },
  { id: 'lost', label: 'Lost' },
];

export interface OwnerProspect {
  id: string;
  business_name: string;
  website: string;
  industry: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  lead_score: LeadScore | null;
  scan_score: number | null;
  scan_risk_level: string | null;
  scan_findings: Record<string, unknown> | null;
  scan_status: 'pending' | 'running' | 'completed' | 'failed';
  conversion_likelihood: number | null;
  estimated_mrr: number | null;
  estimated_arr: number | null;
  opportunity_priority: number | null;
  pipeline_state: string;
  discovery_source: string | null;
  discovery_source_url: string | null;
  top_issue: string | null;
  dns_valid: boolean | null;
  http_valid: boolean | null;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OwnerOutreachDraft {
  id: string;
  prospect_id: string | null;
  outreach_type: string;
  business_name: string | null;
  content: string;
  status: 'draft' | 'approved' | 'sent';
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OwnerCrmLead {
  id: string;
  business_name: string;
  website: string | null;
  industry: string | null;
  contact_name: string | null;
  contact_email: string | null;
  notes: string | null;
  stage: CrmStage;
  lead_score: LeadScore | null;
  potential_revenue: number | null;
  last_contact_at: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OwnerCampaign {
  id: string;
  name: string;
  duration_days: number;
  start_date: string | null;
  status: 'draft' | 'active' | 'completed';
  daily_goal: string | null;
  goals_completed: number;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OwnerCampaignTask {
  id: string;
  campaign_id: string;
  title: string;
  day_offset: number;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface OwnerCompetitor {
  id: string;
  name: string;
  website: string | null;
  pricing_notes: string | null;
  features: string | null;
  positioning: string | null;
  advantages: string | null;
  gaps: string | null;
  opportunities: string | null;
  last_reviewed_at: string | null;
  changes_notes: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OwnerContentPost {
  id: string;
  platform: string;
  title: string | null;
  content: string | null;
  status: 'draft' | 'published';
  views: number;
  leads_generated: number;
  customers_acquired: number;
  published_at: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type TrendWindow = 'today' | '7d' | '30d' | '90d';

export interface BusinessOverviewMetrics {
  mrr: number;
  arr: number;
  mrrGrowthPct: number;
  totalUsers: number;
  newSignups: number;
  websites: number;
  scans: number;
  conversionRate: number;
  window: TrendWindow;
}
