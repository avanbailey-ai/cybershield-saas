import type { FounderBriefing } from '@/lib/owner/briefing';
import type {
  BusinessOverviewMetrics,
  TrendWindow,
  OwnerProspect,
  OwnerCrmLead,
  OwnerCampaign,
  OwnerCampaignTask,
  OwnerCompetitor,
  OwnerContentPost,
} from '@/lib/owner/types';
import type { MarketingInsight } from '@/lib/owner/generators/insights';
import type { CustomerIntelligenceSummary } from '@/lib/owner/customerIntelligence';
import type { DataMoatSnapshot } from '@/lib/owner/dataMoat';
import type { RevenueOpportunitySummary } from '@/lib/owner/revenueOpportunity';
import type { ContentSuggestion } from '@/lib/owner/generators/contentIntel';
import type { CeoAdvisoryData } from '@/lib/owner/ceoAdvisory';
import type { CeoDashboard } from '@/lib/owner/ceoDashboard';

type CampaignWithTasks = OwnerCampaign & { owner_campaign_tasks: OwnerCampaignTask[] };

export interface FounderCommandCenterProps {
  briefing: FounderBriefing;
  windows: Record<TrendWindow, BusinessOverviewMetrics>;
  prospects: OwnerProspect[];
  campaigns: CampaignWithTasks[];
  crmLeads: OwnerCrmLead[];
  competitors: OwnerCompetitor[];
  contentPosts: OwnerContentPost[];
  insights: MarketingInsight[];
  intelligence: CustomerIntelligenceSummary;
  moat: DataMoatSnapshot;
  revenue: RevenueOpportunitySummary;
  contentSuggestions: ContentSuggestion[];
  ceoAdvisory: CeoAdvisoryData;
  ceoDashboard: CeoDashboard;
}
