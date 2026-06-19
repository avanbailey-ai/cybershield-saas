import type { FounderInboxItem } from '@/lib/owner/founderOsV5';
import type { OwnerProspect } from '@/lib/owner/types';
import { isAgencyKind } from '@/lib/owner/prospectDisplay';
import {
  countActiveProspectsByKind,
  resolveBestLeadForKind,
} from '@/lib/owner/founderPipelineSignals';
import type { FounderIntelligenceSnapshot, FounderRecommendation } from './types';

export interface FounderRecommendationInput {
  inbox: FounderInboxItem[];
  prospects: OwnerProspect[];
  followUpsDue: number;
  pendingApprovals: number;
  payingCustomers: number;
  mrrCents: number;
  emailOpenRate: number | null;
  agencyProspectCount: number;
  smbProspectCount: number;
}

function leadWhy(prospect: OwnerProspect): string {
  const parts: string[] = [];
  if (prospect.opportunity_score != null) {
    parts.push(`Opportunity score ${prospect.opportunity_score}/100`);
  }
  if (prospect.estimated_plan_fit) {
    parts.push(`est. ${prospect.estimated_plan_fit}`);
  }
  if (prospect.contact_email_found) {
    parts.push('contact email on file');
  }
  if (prospect.selection_reason?.trim()) {
    parts.push(prospect.selection_reason.trim());
  }
  return parts.length > 0 ? parts.join(' · ') : 'Qualified prospect in pipeline.';
}

/** Rule-based Founder OS recommendations — real DB fields only. */
export function buildFounderRecommendations(
  input: FounderRecommendationInput,
): FounderIntelligenceSnapshot {
  const dataMissing: string[] = [];
  const warnings: string[] = [];
  const blockedRevenueItems: string[] = [];
  const priorities: FounderRecommendation[] = [];

  const outreach = input.inbox.find((i) => i.type === 'outreach');
  if (outreach) {
    priorities.push({
      id: outreach.id,
      title: outreach.title,
      why: outreach.whyItMatters ?? 'Outreach-ready prospect with contact on file.',
      action: 'Review draft',
      section: 'inbox',
      dataSource: 'founder_inbox',
    });
  } else if (input.pendingApprovals > 0) {
    priorities.push({
      id: 'inbox-pending',
      title: `${input.pendingApprovals} item(s) need approval`,
      why: 'Manual approval is required before any email sends.',
      action: 'Open inbox',
      section: 'inbox',
      dataSource: 'founder_inbox',
    });
  }

  if (input.followUpsDue > 0) {
    priorities.push({
      id: 'follow-ups',
      title: `${input.followUpsDue} follow-up(s) due`,
      why: 'Timely follow-ups improve reply rates on contacted prospects.',
      action: 'Review follow-ups',
      section: 'inbox',
      dataSource: 'owner_follow_ups',
    });
  }

  const risk = input.inbox.find((i) => i.type === 'customer_risk');
  if (risk) {
    priorities.push({
      id: risk.id,
      title: risk.title,
      why: risk.whyItMatters ?? 'Protect recurring revenue.',
      action: 'Review retention',
      section: 'success',
      dataSource: 'customer_health',
    });
  }

  if (input.agencyProspectCount === 0) {
    warnings.push(
      'Agency discovery enabled — no agency prospects found yet. Run Agency Discovery when ready.',
    );
  }

  if (input.emailOpenRate != null && input.emailOpenRate > 100) {
    warnings.push('Email open rate calculation exceeds 100% — metrics need review.');
  }

  if (input.pendingApprovals > 0 && !outreach) {
    blockedRevenueItems.push(`${input.pendingApprovals} outreach approval(s) blocking pipeline progress`);
  }

  const smbLead = resolveBestLeadForKind(input.prospects, input.inbox, 'smb');
  const agencyLead = resolveBestLeadForKind(input.prospects, input.inbox, 'agency');

  const bestSmbLead = smbLead
    ? {
        name: smbLead.business_name ?? 'Unknown',
        why: leadWhy(smbLead),
        dataSource: 'owner_prospects (prospect_kind=smb)',
      }
    : input.smbProspectCount === 0
      ? (dataMissing.push('No SMB prospects in pipeline'), null)
      : null;

  const bestAgencyLead = agencyLead
    ? {
        name: agencyLead.business_name ?? 'Unknown',
        why: leadWhy(agencyLead),
        dataSource: 'owner_prospects (prospect_kind=agency)',
      }
    : input.agencyProspectCount === 0
      ? (dataMissing.push('No agency-classified prospects'), null)
      : null;

  const nextBestAction = priorities[0]?.action ?? 'Refresh pipeline data';

  return {
    todaysPriorities: priorities.slice(0, 3),
    bestSmbLead,
    bestAgencyLead,
    followUpsDue: input.followUpsDue,
    blockedRevenueItems,
    warnings,
    nextBestAction,
    dataMissing,
  };
}

export function explainLeadChoice(prospect: OwnerProspect): string {
  const kind = isAgencyKind(prospect) ? 'Agency' : 'SMB';
  const lines = [
    `${prospect.business_name ?? 'Prospect'} is classified as ${kind}.`,
    leadWhy(prospect),
  ];
  if (prospect.prospect_kind) {
    lines.push(`Classification: prospect_kind=${prospect.prospect_kind}`);
  }
  if (prospect.pipeline_state) {
    lines.push(`Pipeline stage: ${prospect.pipeline_state}`);
  }
  return lines.join(' ');
}

export function countProspectsByKind(prospects: OwnerProspect[]) {
  return countActiveProspectsByKind(prospects);
}
