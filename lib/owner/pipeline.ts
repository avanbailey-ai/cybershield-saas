import type { LeadScore, OwnerProspect } from './types';
import type { ProspectPipelineState } from './discovery/types';
import { planFitDisplayName, confidenceLabel, contactStatusLabel } from './salesIntelligence';
import { activeProspects } from './prospectFilters';

export { planFitDisplayName, confidenceLabel, contactStatusLabel };

export function pipelineStateFromScan(input: {
  scanStatus: string;
  leadScore?: LeadScore | null;
  currentState?: ProspectPipelineState | null;
  opportunityScore?: number | null;
}): ProspectPipelineState {
  const terminal: ProspectPipelineState[] = [
    'contacted',
    'interested',
    'customer',
    'archived',
    'ignore_forever',
  ];
  if (input.currentState && terminal.includes(input.currentState)) {
    return input.currentState;
  }

  if (input.scanStatus !== 'completed') {
    return 'new_discovery';
  }

  if (input.opportunityScore !== null && input.opportunityScore !== undefined && input.opportunityScore < 25) {
    return 'new_discovery';
  }

  if (input.leadScore === 'HOT') return 'outreach_ready';
  if (input.leadScore === 'WARM') return 'qualified';
  if ((input.opportunityScore ?? 0) >= 50) return 'qualified';
  return 'new_discovery';
}

export function topIssueFromFindings(findings: { issues?: string[] } | null): string | null {
  const issues = findings?.issues ?? [];
  return issues[0] ?? null;
}

export const PIPELINE_TABS = {
  new_discovery: { id: 'new_discovery', label: 'New Discoveries' },
  qualified: { id: 'qualified', label: 'Qualified' },
  outreach_ready: { id: 'outreach_ready', label: 'Outreach Ready' },
  contacted: { id: 'contacted', label: 'Contacted' },
  interested: { id: 'interested', label: 'Interested' },
  customer: { id: 'customer', label: 'Customer' },
  archived: { id: 'archived', label: 'Archived' },
} as const;

export type ProspectTabId = keyof typeof PIPELINE_TABS;

const TAB_STATES: Record<ProspectTabId, string[]> = {
  new_discovery: ['new', 'new_discovery', 'scanned'],
  qualified: ['qualified'],
  outreach_ready: ['outreach_ready'],
  contacted: ['contacted'],
  interested: ['interested'],
  customer: ['customer'],
  archived: ['archived', 'ignore_forever'],
};

export function prospectsForTab(
  prospects: OwnerProspect[],
  tab: ProspectTabId,
  includeHidden = false,
): OwnerProspect[] {
  const states = TAB_STATES[tab];
  return prospects
    .filter((p) => {
      if (p.deleted_at) return false;
      if (!includeHidden && tab !== 'archived') {
        if (p.pipeline_state === 'archived' || p.pipeline_state === 'ignore_forever') return false;
      }
      return states.includes(p.pipeline_state ?? 'new_discovery');
    })
    .sort((a, b) => (b.opportunity_score ?? b.opportunity_priority ?? 0) - (a.opportunity_score ?? a.opportunity_priority ?? 0));
}

export function countByStage(prospects: OwnerProspect[]): Record<ProspectTabId, number> {
  const counts = {} as Record<ProspectTabId, number>;
  for (const id of Object.keys(PIPELINE_TABS) as ProspectTabId[]) {
    counts[id] = prospectsForTab(prospects, id, id === 'archived').length;
  }
  return counts;
}

export function hasActiveProspects(prospects: OwnerProspect[]): boolean {
  return activeProspects(prospects).length > 0;
}

export function recommendedAction(p: OwnerProspect): { label: string; action: string } {
  if (p.pipeline_state === 'outreach_ready' || p.lead_score === 'HOT') {
    return { label: 'Generate outreach', action: 'outreach' };
  }
  if (!p.contact_email_found && !p.contact_phone_found && p.scan_status === 'completed') {
    return { label: 'Find contact', action: 'contact' };
  }
  if (p.scan_status === 'completed') {
    return { label: 'Review scan findings', action: 'review' };
  }
  if (p.scan_status === 'failed') {
    return { label: 'Retry scan', action: 'scan' };
  }
  if (isDeprioritized(p)) {
    return { label: 'Archive', action: 'archive' };
  }
  return { label: 'Run security scan', action: 'scan' };
}

function isDeprioritized(p: OwnerProspect): boolean {
  return (p.opportunity_score ?? 100) < 25;
}

export function prospectNextStep(p: OwnerProspect): string {
  if (p.pipeline_state === 'ignore_forever') return 'Permanently ignored';
  if (p.pipeline_state === 'archived') return 'Unarchive or delete';
  if (p.scan_status === 'pending' || p.scan_status === 'running') return 'Scan in progress';
  if (p.scan_status === 'failed') return 'Retry scan';
  if (p.pipeline_state === 'outreach_ready' || p.lead_score === 'HOT') return 'Generate findings-based outreach';
  if (p.pipeline_state === 'qualified' || p.lead_score === 'WARM') return 'Qualify contact path and send outreach';
  if (p.pipeline_state === 'contacted') return 'Follow up on outreach';
  if (p.pipeline_state === 'interested') return 'Move to CRM and close';
  if (p.pipeline_state === 'customer') return 'Onboard as customer';
  if (p.scan_status === 'completed') return 'Review scan and qualify';
  return 'Run security scan';
}

export function securityScoreLabel(p: OwnerProspect): string {
  if (p.scan_score === null) return '—';
  return `${p.scan_score}/100`;
}

export function opportunityScoreLabel(p: OwnerProspect): string {
  if (p.opportunity_score === null) return '—';
  return `${p.opportunity_score}/100`;
}

export function planFitLabel(p: OwnerProspect): string | null {
  return planFitDisplayName(p.estimated_plan_fit);
}

export function stageEmptyMessage(tab: ProspectTabId, hasGlobalProspects: boolean): {
  title: string;
  description: string;
} {
  if (!hasGlobalProspects) {
    return {
      title: 'No qualified prospects yet',
      description:
        'Run discovery to identify businesses that may benefit from CyberShield monitoring.',
    };
  }
  const stage = PIPELINE_TABS[tab].label;
  return {
    title: `No prospects in ${stage}`,
    description: `Prospects move here as they qualify. Check other pipeline stages or run discovery for new opportunities.`,
  };
}
