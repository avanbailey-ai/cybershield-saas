import type { LeadScore, OwnerProspect } from './types';
import type { ProspectPipelineState } from './discovery/types';
import { planFitDisplayName, confidenceLabel, contactStatusLabel } from './salesIntelligence';
import { activeProspects } from './prospectFilters';
import {
  hasOutreachContact,
  resolveProspectScores,
  isTrulyOutreachReady,
} from './prospectDisplay';
import { assessProspectQuality } from './prospectQualityBrain';

export { planFitDisplayName, confidenceLabel, contactStatusLabel };

export function pipelineStateFromScan(input: {
  scanStatus: string;
  leadScore?: LeadScore | null;
  currentState?: ProspectPipelineState | null;
  opportunityScore?: number | null;
  hasContactEmail?: boolean;
  scanIssues?: string[];
  prospect?: Partial<OwnerProspect>;
}): ProspectPipelineState {
  const terminal: ProspectPipelineState[] = [
    'contacted',
    'interested',
    'customer',
    'archived',
    'ignore_forever',
    'follow_up_scheduled',
    'follow_up_due',
    'bad_fit',
  ];
  if (input.currentState && terminal.includes(input.currentState)) {
    return input.currentState;
  }

  if (input.prospect) {
    const assessment = assessProspectQuality({
      businessName: input.prospect.business_name ?? '',
      website: input.prospect.website ?? '',
      industry: input.prospect.industry ?? null,
      prospectKind: input.prospect.prospect_kind === 'agency' ? 'agency' : 'smb',
      scanStatus: input.scanStatus,
      scanCompleted: input.scanStatus === 'completed',
      leadScore: input.leadScore ?? input.prospect.lead_score,
      opportunityScore: input.opportunityScore ?? input.prospect.opportunity_score ?? 0,
      agencyScore: input.prospect.agency_opportunity_score ?? null,
      agencyLabel: (input.prospect.agency_label as never) ?? null,
      signals: {
        contact_page_found: input.prospect.contact_page_found ?? false,
        contact_email_found: input.prospect.contact_email_found ?? false,
        contact_phone_found: input.prospect.contact_phone_found ?? false,
        contact_linkedin_found: input.prospect.contact_linkedin_found ?? false,
        contact_email: input.prospect.contact_email ?? null,
        contact_phone: input.prospect.contact_phone ?? null,
        contact_linkedin: input.prospect.contact_linkedin ?? null,
        contact_confidence: (input.prospect.contact_confidence as never) ?? 'no_contact',
      },
      httpValid: input.prospect.http_valid,
      dnsValid: input.prospect.dns_valid,
      scanIssues: input.scanIssues,
      planFit: input.prospect.estimated_plan_fit ?? null,
      rejectionReason: (input.prospect.rejection_reason as never) ?? null,
    });
    return assessment.pipelineState;
  }

  if (input.scanStatus !== 'completed') {
    return 'new_discovery';
  }

  if (input.opportunityScore !== null && input.opportunityScore !== undefined && input.opportunityScore < 25) {
    return 'bad_fit';
  }

  if (!input.hasContactEmail) {
    return 'needs_contact';
  }

  const meaningfulFinding =
    (input.opportunityScore ?? 0) >= 25 || (input.scanIssues?.length ?? 0) >= 1;

  if (!meaningfulFinding) {
    return 'needs_review';
  }

  if (
    input.leadScore === 'HOT' ||
    input.leadScore === 'WARM' ||
    (input.opportunityScore ?? 0) >= 45
  ) {
    return 'outreach_ready';
  }

  return 'qualified';
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
  new_discovery: ['new', 'new_discovery', 'scanned', 'needs_contact', 'needs_review'],
  qualified: ['qualified'],
  outreach_ready: ['outreach_ready'],
  contacted: ['contacted', 'follow_up_scheduled', 'follow_up_due'],
  interested: ['interested'],
  customer: ['customer'],
  archived: ['archived', 'ignore_forever', 'bad_fit', 'no_contact_found'],
};

const HIDDEN_STATES = new Set(['archived', 'ignore_forever', 'bad_fit', 'no_contact_found']);
const HIDE_AFTER_MS = 30 * 86400000;

function shouldHideProspect(p: OwnerProspect, tab: ProspectTabId): boolean {
  if (tab === 'archived') return false;
  if (HIDDEN_STATES.has(p.pipeline_state ?? '')) {
    if (p.pipeline_state === 'bad_fit' || p.pipeline_state === 'no_contact_found') {
      const updated = new Date(p.updated_at).getTime();
      if (Date.now() - updated > HIDE_AFTER_MS) return true;
    }
    return p.pipeline_state === 'archived' || p.pipeline_state === 'ignore_forever';
  }
  return false;
}

export function prospectsForTab(
  prospects: OwnerProspect[],
  tab: ProspectTabId,
  includeHidden = false,
): OwnerProspect[] {
  const states = TAB_STATES[tab];
  return prospects
    .map(resolveProspectScores)
    .filter((p) => {
      if (p.deleted_at) return false;
      if (!includeHidden && shouldHideProspect(p, tab)) return false;
      if (!includeHidden && tab !== 'archived') {
        if (p.pipeline_state === 'archived' || p.pipeline_state === 'ignore_forever') return false;
      }
      if (tab === 'outreach_ready' && !isTrulyOutreachReady(p)) return false;
      return states.includes(p.pipeline_state ?? 'new_discovery');
    })
    .sort(
      (a, b) =>
        (b.opportunity_score ?? b.opportunity_priority ?? 0) -
        (a.opportunity_score ?? a.opportunity_priority ?? 0),
    );
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
  const resolved = resolveProspectScores(p);
  if (!p.contact_email?.trim() && (p.contact_phone_found || p.contact_page_found)) {
    return { label: 'Find email address', action: 'contact' };
  }
  if (
    isTrulyOutreachReady(resolved)
  ) {
    return { label: 'Approve & send outreach', action: 'outreach' };
  }
  if (resolved.pipeline_state === 'outreach_ready' && !hasOutreachContact(resolved)) {
    return { label: 'Find email first', action: 'contact' };
  }
  if (!hasOutreachContact(p) && p.scan_status === 'completed') {
    return { label: 'Find email', action: 'contact' };
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
  const score = resolveProspectScores(p).opportunity_score;
  if (score === null || score === undefined) return '—';
  return `${score}/100`;
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
