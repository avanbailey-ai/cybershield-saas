import { createAdminClient } from '@/lib/supabase/admin';
import { getFounderOsV6 } from './founderOsV6';
import { getBusinessHealthMetrics } from './businessHealthMetrics';
import { getAutomationHealth } from './automationHealth';
import { getCustomerDirectory } from './customerDirectory';
import { buildRevenueOpportunities } from './revenueOpportunities';
import { hasOutreachContact, resolveProspectList } from './prospectDisplay';
import { BANNED_DEMO_PATTERNS } from './founderNav';
import type { OwnerProspect } from './types';

export interface FounderOsAuditExport {
  exportedAt: string;
  dashboardMetrics: Awaited<ReturnType<typeof getBusinessHealthMetrics>>;
  inbox: Awaited<ReturnType<typeof getFounderOsV6>>['inbox'];
  prospects: {
    total: number;
    outreachReadyWithContact: number;
    withoutContact: number;
    archived: number;
  };
  customers: Awaited<ReturnType<typeof getCustomerDirectory>>;
  failedAutomations: {
    failedDrafts: number;
    failedDraftDetails: { id: string; businessName: string; error: string | null }[];
  };
  staleItems: {
    oldDiscoveryRuns: number;
    expiredDraftCandidates: number;
    dueFollowUps: number;
  };
  buttonStates: {
    approveOutreachRequiresContact: boolean;
    approveAllInboxTypes: string[];
    deadPatternsFound: string[];
  };
  featureHealth: Awaited<ReturnType<typeof getAutomationHealth>>;
  revenueOpportunities: ReturnType<typeof buildRevenueOpportunities>;
  suspectedLogicProblems: string[];
  v6Summary: {
    executionStats: Awaited<ReturnType<typeof getFounderOsV6>>['v6']['executionStats'];
    homeSummary: Awaited<ReturnType<typeof getFounderOsV6>>['v6']['homeSummary'];
  };
}

export async function buildFounderOsAuditExport(): Promise<FounderOsAuditExport> {
  const admin = createAdminClient();
  const [founderData, businessHealth, automationHealth, customers] = await Promise.all([
    getFounderOsV6(),
    getBusinessHealthMetrics(),
    getAutomationHealth(),
    getCustomerDirectory(),
  ]);

  const prospectsRes = await admin
    .from('owner_prospects')
    .select('id, pipeline_state, contact_email, business_name, website, deleted_at')
    .is('deleted_at', null);

  const allProspects = resolveProspectList((prospectsRes.data ?? []) as OwnerProspect[]);
  const outreachReady = allProspects.filter((p) => p.pipeline_state === 'outreach_ready');
  const withoutContact = outreachReady.filter((p) => !hasOutreachContact(p));

  const { data: failedDrafts } = await admin
    .from('owner_outreach_drafts')
    .select('id, business_name, send_error')
    .eq('status', 'failed')
    .is('deleted_at', null)
    .limit(20);

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { count: oldRuns } = await admin
    .from('owner_discovery_runs')
    .select('id', { count: 'exact', head: true })
    .lt('created_at', sevenDaysAgo);

  const draftCutoff = new Date(Date.now() - 14 * 86400000).toISOString();
  const { count: expiredDrafts } = await admin
    .from('owner_outreach_drafts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'draft')
    .is('deleted_at', null)
    .lt('created_at', draftCutoff);

  const { count: dueFollowUps } = await admin
    .from('owner_follow_ups')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'due');

  const signups24 = founderData.v6.activityFeed.events.filter((e) => e.type === 'signup').length;
  const revenueOpportunities = buildRevenueOpportunities({
    prospects: allProspects,
    inbox: founderData.inbox,
    expansion: founderData.v6.expansion,
    revenueAtRisk: founderData.v6.revenueAtRisk,
    signups24h: signups24,
  });

  const suspectedLogicProblems: string[] = [];
  if (withoutContact.length > 0) {
    suspectedLogicProblems.push(
      `${withoutContact.length} outreach-ready prospect(s) lack contact email — Approve & Send blocked.`,
    );
  }
  if ((failedDrafts ?? []).length > 0) {
    suspectedLogicProblems.push(
      `${failedDrafts?.length} failed outreach draft(s) need retry.`,
    );
  }
  if (founderData.v6.executionStats.pendingApprovals !== founderData.inbox.filter((i) => i.type === 'outreach').length) {
    suspectedLogicProblems.push(
      'pendingApprovals count may not include all approvable inbox types (follow-ups, retention, expansion).',
    );
  }
  if (businessHealth.mrr === 0 && businessHealth.payingCustomers > 0) {
    suspectedLogicProblems.push('MRR is zero but payingCustomers > 0 — check plan price mapping.');
  }

  const serialized = JSON.stringify(founderData);
  const deadPatternsFound = BANNED_DEMO_PATTERNS.filter((p) => serialized.includes(p));

  return {
    exportedAt: new Date().toISOString(),
    dashboardMetrics: businessHealth,
    inbox: founderData.inbox,
    prospects: {
      total: allProspects.length,
      outreachReadyWithContact: outreachReady.filter(hasOutreachContact).length,
      withoutContact: withoutContact.length,
      archived: allProspects.filter(
        (p) => p.pipeline_state === 'archived' || p.pipeline_state === 'ignore_forever',
      ).length,
    },
    customers,
    failedAutomations: {
      failedDrafts: failedDrafts?.length ?? 0,
      failedDraftDetails: (failedDrafts ?? []).map((d) => ({
        id: d.id as string,
        businessName: (d.business_name as string) ?? 'Unknown',
        error: (d.send_error as string) ?? null,
      })),
    },
    staleItems: {
      oldDiscoveryRuns: oldRuns ?? 0,
      expiredDraftCandidates: expiredDrafts ?? 0,
      dueFollowUps: dueFollowUps ?? 0,
    },
    buttonStates: {
      approveOutreachRequiresContact: true,
      approveAllInboxTypes: [
        'outreach',
        'follow_up',
        'failed_email',
        'customer_risk',
        'expansion',
        'signup',
      ],
      deadPatternsFound,
    },
    featureHealth: automationHealth,
    revenueOpportunities,
    suspectedLogicProblems,
    v6Summary: {
      executionStats: founderData.v6.executionStats,
      homeSummary: founderData.v6.homeSummary,
    },
  };
}
