'use client';

import DailyBriefing from './DailyBriefing';
import BusinessOverview from './BusinessOverview';
import LeadDiscovery from './LeadDiscovery';
import OutreachGenerator from './OutreachGenerator';
import SocialContentStudio from './SocialContentStudio';
import VideoAdCreator from './VideoAdCreator';
import CampaignPlanner from './CampaignPlanner';
import LeadCrm from './LeadCrm';
import CompetitorIntel from './CompetitorIntel';
import ContentPerformance from './ContentPerformance';
import MarketingInsights from './MarketingInsights';
import CustomerIntelligencePanel from './CustomerIntelligence';
import DataMoatPanel from './DataMoatPanel';
import type { FounderBriefing } from '@/lib/owner/briefing';
import type { BusinessOverviewMetrics, TrendWindow, OwnerProspect, OwnerCrmLead, OwnerCampaign, OwnerCampaignTask, OwnerCompetitor, OwnerContentPost } from '@/lib/owner/types';
import type { MarketingInsight } from '@/lib/owner/generators/insights';
import type { CustomerIntelligenceSummary } from '@/lib/owner/customerIntelligence';
import type { DataMoatSnapshot } from '@/lib/owner/dataMoat';

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
}

export default function FounderCommandCenter(props: FounderCommandCenterProps) {
  return (
    <div className="space-y-8 p-6 lg:p-8">
      <header className="border-b border-violet-500/10 pb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
          CyberShield Founder OS
        </p>
        <h1 className="mt-1 text-3xl font-bold text-white">Growth Command Center</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-500">
          Executive command center for revenue, outbound, content, and competitive intelligence.
          Owner-only access.
        </p>
      </header>

      <DailyBriefing briefing={props.briefing} />
      <BusinessOverview initialWindows={props.windows} />
      <LeadDiscovery initialProspects={props.prospects} />
      <OutreachGenerator prospects={props.prospects} />
      <SocialContentStudio />
      <VideoAdCreator />
      <CampaignPlanner initialCampaigns={props.campaigns} />
      <LeadCrm initialLeads={props.crmLeads} />
      <CompetitorIntel initialCompetitors={props.competitors} />
      <ContentPerformance initialPosts={props.contentPosts} />
      <MarketingInsights insights={props.insights} />
      <CustomerIntelligencePanel intelligence={props.intelligence} />
      <DataMoatPanel moat={props.moat} />
    </div>
  );
}
