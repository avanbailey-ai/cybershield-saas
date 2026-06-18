import type { LeadScore, OwnerProspect } from './types';
import type { ProspectPipelineState } from './discovery/types';

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
  new_discovery: { id: 'new_discovery', label: 'New Discovery' },
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
  if (!p.estimated_plan_fit) return null;
  return `$${p.estimated_plan_fit}/mo`;
}
