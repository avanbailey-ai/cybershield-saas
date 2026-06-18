'use client';

import { useState } from 'react';
import OutreachGenerator from '../OutreachGenerator';
import SocialContentStudio from '../SocialContentStudio';
import CampaignPlanner from '../CampaignPlanner';
import EmptyState from '../EmptyState';
import { useFounderNav } from '../FounderNavContext';
import type { OwnerProspect, OwnerCampaign, OwnerCampaignTask } from '@/lib/owner/types';
import type { ContentSuggestion } from '@/lib/owner/generators/contentIntel';

type CampaignWithTasks = OwnerCampaign & { owner_campaign_tasks: OwnerCampaignTask[] };

type OutreachTab = 'outreach' | 'drafts' | 'campaigns' | 'content';

interface Props {
  prospects: OwnerProspect[];
  campaigns: CampaignWithTasks[];
  contentSuggestions: ContentSuggestion[];
}

export default function OutreachView({ prospects, campaigns, contentSuggestions }: Props) {
  const { setSection } = useFounderNav();
  const [tab, setTab] = useState<OutreachTab>('outreach');
  const hot = prospects.filter((p) => p.lead_score === 'HOT' && p.scan_status === 'completed');

  const tabs: { id: OutreachTab; label: string }[] = [
    { id: 'outreach', label: 'Generate' },
    { id: 'drafts', label: 'Drafts' },
    { id: 'campaigns', label: 'Campaigns' },
    { id: 'content', label: 'Content ideas' },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Outreach</h1>
        <p className="mt-2 text-gray-500">Turn scan findings into conversations</p>
      </header>

      {hot.length > 0 && (
        <section className="rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4">
          <p className="text-sm font-medium text-red-300">
            {hot.length} HOT prospect{hot.length !== 1 ? 's' : ''} ready for outreach
          </p>
          <ul className="mt-2 space-y-1">
            {hot.slice(0, 5).map((p) => (
              <li key={p.id} className="text-sm text-gray-400">
                {p.business_name} · {p.scan_score}/100
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex gap-1 border-b border-white/10">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === t.id
                ? 'border-violet-500 text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'outreach' && (
        hot.length === 0 ? (
          <EmptyState
            title="No HOT prospects yet"
            description="Import websites and run scans to unlock findings-based outreach."
            action={
              <button
                type="button"
                onClick={() => setSection('prospects')}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
              >
                Go to Prospects
              </button>
            }
          />
        ) : (
          <OutreachGenerator prospects={prospects} embedded />
        )
      )}

      {tab === 'drafts' && <OutreachGenerator prospects={prospects} embedded />}

      {tab === 'campaigns' &&
        (campaigns.length === 0 ? (
          <EmptyState
            title="No campaigns launched"
            description="Create your first outreach campaign to nurture prospects and signups."
          />
        ) : (
          <CampaignPlanner initialCampaigns={campaigns} embedded />
        ))}

      {tab === 'content' && (
        <SocialContentStudio suggestions={contentSuggestions} embedded />
      )}
    </div>
  );
}
