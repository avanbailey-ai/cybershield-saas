'use client';

import { useEffect } from 'react';
import DailyBriefing from './DailyBriefing';
import BusinessOverview from './BusinessOverview';
import CeoAdvisoryPanel from './CeoAdvisoryPanel';
import LeadDiscovery from './LeadDiscovery';
import OpportunityCenter from './OpportunityCenter';
import RevenueOpportunityPanel from './RevenueOpportunityPanel';
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
import type { RevenueOpportunitySummary } from '@/lib/owner/revenueOpportunity';
import type { ContentSuggestion } from '@/lib/owner/generators/contentIntel';
import type { CeoAdvisoryData } from '@/lib/owner/ceoAdvisory';

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
}

export default function FounderCommandCenter(props: FounderCommandCenterProps) {
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }, []);
  return (
    <div className="space-y-8 p-6 lg:p-8">
      <header className="border-b border-violet-500/10 pb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
          CyberShield Founder OS
        </p>
        <h1 className="mt-1 text-3xl font-bold text-white">Growth Command Center</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-500">
          What should Avan do today to grow CyberShield? Briefing, imports, scans, CRM, and outreach —
          every metric here comes from live product data only. Owner-only.
        </p>
      </header>

      <DailyBriefing briefing={props.briefing} />
      <BusinessOverview initialWindows={props.windows} />
      <CeoAdvisoryPanel data={props.ceoAdvisory} />
      <LeadDiscovery initialProspects={props.prospects} />
      <OpportunityCenter revenue={props.revenue} crmLeads={props.crmLeads} />
      <RevenueOpportunityPanel revenue={props.revenue} />
      <OutreachGenerator prospects={props.prospects} />
      <SocialContentStudio suggestions={props.contentSuggestions} />
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
