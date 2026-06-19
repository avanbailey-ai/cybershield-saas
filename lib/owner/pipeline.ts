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
import {
  recommendedOutreachAction,
  prospectNextStepLabel,
} from './prospectVerdict';

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
  outreach_ready: { id: 'outreach_ready', label: 'Pending approval' },
  contacted: { id: 'contacted', label: 'Contacted' },
  interested: { id: 'interested', label: 'Interested' },
  customer: { id: 'customer', label: 'Customer' },
  archived: { id: 'archived', label: 'Archived' },
} as const;

export interface PipelineTabOptions {
  includeHidden?: boolean;
  /** Prospects with active outreach drafts awaiting founder approval. */
  pendingDraftProspectIds?: Set<string>;
}

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
  options: PipelineTabOptions = {},
): OwnerProspect[] {
  const includeHidden = options.includeHidden ?? false;
  const pendingDrafts = options.pendingDraftProspectIds;
  const states = TAB_STATES[tab];
  return prospects
    .map(resolveProspectScores)
    .filter((p) => {
      if (p.deleted_at) return false;
      if (!includeHidden && shouldHideProspect(p, tab)) return false;
      if (!includeHidden && tab !== 'archived') {
        if (p.pipeline_state === 'archived' || p.pipeline_state === 'ignore_forever') return false;
      }
      if (tab === 'outreach_ready') {
        if (pendingDrafts?.has(p.id)) return true;
        if (!isTrulyOutreachReady(p)) return false;
        return states.includes(p.pipeline_state ?? 'new_discovery');
      }
      return states.includes(p.pipeline_state ?? 'new_discovery');
    })
    .sort(
      (a, b) =>
        (b.opportunity_score ?? b.opportunity_priority ?? 0) -
        (a.opportunity_score ?? a.opportunity_priority ?? 0),
    );
}

export function countByStage(
  prospects: OwnerProspect[],
  options: PipelineTabOptions = {},
): Record<ProspectTabId, number> {
  const counts = {} as Record<ProspectTabId, number>;
  for (const id of Object.keys(PIPELINE_TABS) as ProspectTabId[]) {
    counts[id] = prospectsForTab(prospects, id, {
      ...options,
      includeHidden: id === 'archived' ? true : options.includeHidden,
    }).length;
  }
  return counts;
}

export function hasActiveProspects(prospects: OwnerProspect[]): boolean {
  return activeProspects(prospects).length > 0;
}

export function recommendedAction(p: OwnerProspect): { label: string; action: string } {
  return recommendedOutreachAction(p);
}

export function prospectNextStep(p: OwnerProspect): string {
  return prospectNextStepLabel(p);
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
  if (tab === 'outreach_ready') {
    return {
      title: 'No drafts pending approval',
      description:
        'When outreach drafts are generated, they appear here for review before Resend sends.',
    };
  }
  const stage = PIPELINE_TABS[tab].label;
  return {
    title: `No prospects in ${stage}`,
    description: `Prospects move here as they qualify. Check other pipeline stages or run discovery for new opportunities.`,
  };
}
