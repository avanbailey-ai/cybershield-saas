import type { LeadScore, OwnerProspect } from './types';
import type { ProspectPipelineState } from './discovery/types';

export function pipelineStateFromScan(input: {
  scanStatus: string;
  leadScore?: LeadScore | null;
  currentState?: ProspectPipelineState | null;
}): ProspectPipelineState {
  const terminal: ProspectPipelineState[] = [
    'contacted',
    'interested',
    'customer',
    'archived',
  ];
  if (input.currentState && terminal.includes(input.currentState)) {
    return input.currentState;
  }

  if (input.scanStatus !== 'completed') {
    return 'new';
  }

  if (input.leadScore === 'HOT') return 'outreach_ready';
  if (input.leadScore === 'WARM') return 'qualified';
  return 'scanned';
}

export function topIssueFromFindings(findings: { issues?: string[] } | null): string | null {
  const issues = findings?.issues ?? [];
  return issues[0] ?? null;
}

export const PIPELINE_TABS = {
  new: { id: 'new', label: 'New Discoveries' },
  qualified: { id: 'qualified', label: 'Qualified Prospects' },
  outreach_ready: { id: 'outreach_ready', label: 'Outreach Ready' },
  archived: { id: 'archived', label: 'Archived' },
} as const;

export type ProspectTabId = keyof typeof PIPELINE_TABS;

const TAB_STATES: Record<ProspectTabId, string[]> = {
  new: ['new', 'scanned'],
  qualified: ['qualified', 'contacted', 'interested'],
  outreach_ready: ['outreach_ready', 'customer'],
  archived: ['archived'],
};

export function prospectsForTab(
  prospects: OwnerProspect[],
  tab: ProspectTabId,
): OwnerProspect[] {
  const states = TAB_STATES[tab];
  return prospects
    .filter((p) => !p.deleted_at && states.includes(p.pipeline_state ?? 'new'))
    .sort((a, b) => (b.opportunity_priority ?? 0) - (a.opportunity_priority ?? 0));
}

export function prospectNextStep(p: OwnerProspect): string {
  if (p.pipeline_state === 'archived') return 'Unarchive or delete';
  if (p.scan_status === 'pending' || p.scan_status === 'running') return 'Scan in progress';
  if (p.scan_status === 'failed') return 'Retry scan';
  if (p.pipeline_state === 'outreach_ready' || p.lead_score === 'HOT') return 'Send outreach';
  if (p.pipeline_state === 'qualified' || p.lead_score === 'WARM') return 'Qualify for outreach';
  if (p.pipeline_state === 'contacted') return 'Follow up';
  if (p.pipeline_state === 'interested') return 'Move to CRM';
  if (p.pipeline_state === 'customer') return 'Onboard customer';
  if (p.scan_status === 'completed') return 'Review scan results';
  return 'Run scan';
}
