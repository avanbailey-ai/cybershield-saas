import { createAdminClient } from '@/lib/supabase/admin';
import { getBusinessOverview, getOverviewAllWindows } from './metrics';
import { isInternalCustomerProfile } from './internalAccountFilters';
import { buildRevenueOpportunity } from './revenueOpportunity';
import type { FounderBriefing } from './briefing';
import type { BusinessOverviewMetrics, OwnerCrmLead, OwnerProspect, TrendWindow } from './types';
import type { RevenueOpportunitySummary } from './revenueOpportunity';
import type { CustomerIntelligenceSummary } from './customerIntelligence';

export interface CeoSnapshot {
  mrr: number;
  arr: number;
  payingCustomers: number;
  trialUsers: number;
  newSignupsToday: number;
  scansToday: number;
  conversionRate: number;
  churnRiskLevel: 'Low' | 'Medium' | 'High';
  churnRiskCount: number;
  growth30dPct: number;
}

export interface TodayChange {
  label: string;
  value: number | string;
}

export interface RevenueOpportunityItem {
  id: string;
  title: string;
  estimatedMrr: number | null;
  reason: string;
  action: string;
  module: string;
}

export interface CeoPriority {
  id: string;
  title: string;
  reason: string;
  expectedOutcome: string;
  impact: 'critical' | 'high' | 'medium';
  module: string;
  cta: string;
}

export interface BusinessWarning {
  id: string;
  severity: 'critical' | 'warning';
  message: string;
  action?: string;
  module?: string;
}

export interface FocusStep {
  id: string;
  label: string;
  done?: boolean;
}

export interface CeoDashboard {
  generatedAt: string;
  snapshot: CeoSnapshot;
  interpretation: string;
  changesToday: TodayChange[];
  opportunities: RevenueOpportunityItem[];
  priorities: CeoPriority[];
  focusBlock: FocusStep[];
  warnings: BusinessWarning[];
  nextAction: CeoPriority | null;
  revenueAtRisk: { summary: string; items: string[] };
  next1kPath: { summary: string; steps: string[] };
}

export const EMPTY_CEO_DASHBOARD: CeoDashboard = {
  generatedAt: new Date(0).toISOString(),
  snapshot: {
    mrr: 0,
    arr: 0,
    payingCustomers: 0,
    trialUsers: 0,
    newSignupsToday: 0,
    scansToday: 0,
    conversionRate: 0,
    churnRiskLevel: 'Low',
    churnRiskCount: 0,
    growth30dPct: 0,
  },
  interpretation: 'Loading business snapshot…',
  changesToday: [],
  opportunities: [],
  priorities: [],
  focusBlock: [],
  warnings: [],
  nextAction: null,
  revenueAtRisk: { summary: '', items: [] },
  next1kPath: { summary: '', steps: [] },
};

function churnLevel(count: number): 'Low' | 'Medium' | 'High' {
  if (count >= 5) return 'High';
  if (count >= 2) return 'Medium';
  return 'Low';
}

function interpretSnapshot(s: CeoSnapshot): string {
  if (s.payingCustomers === 0 && s.mrr === 0) {
    return 'CyberShield has no paying customers yet. The next priority is converting your first signup into a paying customer.';
  }
  if (s.newSignupsToday > 0 && s.payingCustomers > 0) {
    return 'CyberShield is growing with new signup activity. The next priority is converting new users and contacting high-intent prospects.';
  }
  if (s.growth30dPct > 0) {
    return 'CyberShield is growing slowly but steadily. Focus on converting trials and outreach to scanned prospects.';
  }
  if (s.churnRiskLevel === 'High') {
    return 'Revenue is at risk from churn signals. Prioritize retention before new acquisition.';
  }
  return 'CyberShield is stable. Focus on outreach to scanned prospects and onboarding new signups.';
}

function sumNullable(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number' && v > 0);
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0);
}

export function buildCeoPriorities(input: {
  briefing: FounderBriefing;
  prospects: OwnerProspect[];
  crmLeads: OwnerCrmLead[];
  revenue: RevenueOpportunitySummary;
}): CeoPriority[] {
  const priorities: CeoPriority[] = [];
  const hotScanned = input.prospects.filter(
    (p) => p.lead_score === 'HOT' && p.scan_status === 'completed' && !p.archived_at,
  );
  const demoTrial = input.crmLeads.filter(
    (l) => (l.stage === 'demo' || l.stage === 'trial') && !l.archived_at,
  );
  const staleCrm = input.crmLeads.filter((l) => {
    if (l.archived_at || l.stage === 'customer' || l.stage === 'lost') return false;
    if (!l.last_contact_at) return true;
    const days = (Date.now() - new Date(l.last_contact_at).getTime()) / 86400000;
    return days > 14;
  });

  if (hotScanned.length > 0) {
    const count = Math.min(5, hotScanned.length);
    priorities.push({
      id: 'outreach-hot-batch',
      title: `Send outreach to ${count} highest-risk prospect${count !== 1 ? 's' : ''}`,
      reason: `${hotScanned.length} scanned prospect${hotScanned.length !== 1 ? 's have' : ' has'} clear security findings. Outreach is the fastest path to new revenue today.`,
      expectedOutcome: 'Start conversations with businesses that have verified scan results.',
      impact: 'critical',
      module: 'outreach',
      cta: 'Generate outreach',
    });
  }

  if (input.briefing.newSignups > 0) {
    priorities.push({
      id: 'onboard-signups',
      title: `Onboard ${input.briefing.newSignups} new signup${input.briefing.newSignups !== 1 ? 's' : ''} from today`,
      reason: 'New accounts in the last 24 hours need activation while intent is highest.',
      expectedOutcome: 'Higher trial-to-paid conversion from timely onboarding.',
      impact: 'critical',
      module: 'customers',
      cta: 'Review signups',
    });
  }

  if (demoTrial.length > 0) {
    priorities.push({
      id: 'close-demo-trial',
      title: `Follow up with ${demoTrial.length} demo/trial lead${demoTrial.length !== 1 ? 's' : ''}`,
      reason: 'CRM shows active demo or trial stages — these are closest to revenue.',
      expectedOutcome: 'Move qualified leads to paying customers.',
      impact: 'high',
      module: 'crm',
      cta: 'Open CRM',
    });
  }

  if ((input.briefing.churnRisk ?? 0) > 0) {
    priorities.push({
      id: 'retention',
      title: `Review ${input.briefing.churnRisk} at-risk customer${input.briefing.churnRisk !== 1 ? 's' : ''}`,
      reason: 'Platform churn risk scores indicate accounts that may cancel without intervention.',
      expectedOutcome: 'Protect existing MRR through retention outreach.',
      impact: 'high',
      module: 'customers',
      cta: 'View customers',
    });
  }

  if (staleCrm.length > 0 && priorities.length < 5) {
    priorities.push({
      id: 'stale-crm',
      title: `Re-engage ${staleCrm.length} stale CRM lead${staleCrm.length !== 1 ? 's' : ''}`,
      reason: 'Leads with no contact in 14+ days are cooling off.',
      expectedOutcome: 'Recover pipeline momentum before opportunities go cold.',
      impact: 'medium',
      module: 'crm',
      cta: 'Open CRM',
    });
  }

  const pendingScans = input.prospects.filter(
    (p) => p.scan_status === 'pending' && !p.archived_at,
  ).length;
  if (pendingScans > 0 && priorities.length < 5) {
    priorities.push({
      id: 'scan-pending',
      title: `Run scans on ${pendingScans} pending prospect${pendingScans !== 1 ? 's' : ''}`,
      reason: 'Scans unlock HOT/WARM tiers and findings-based outreach.',
      expectedOutcome: 'More qualified outreach opportunities with real scan data.',
      impact: 'high',
      module: 'prospects',
      cta: 'Run discovery',
    });
  }

  if (priorities.length === 0) {
    priorities.push({
      id: 'first-customer',
      title: 'Convert your first paying customer',
      reason: 'No revenue opportunities detected yet. Start with discovery, scans, and onboarding.',
      expectedOutcome: 'First MRR from a real customer conversion.',
      impact: 'critical',
      module: 'prospects',
      cta: 'Run discovery',
    });
  }

  return priorities.slice(0, 5);
}

export function buildRevenueOpportunities(input: {
  prospects: OwnerProspect[];
  crmLeads: OwnerCrmLead[];
  briefing: FounderBriefing;
}): RevenueOpportunityItem[] {
  const items: RevenueOpportunityItem[] = [];
  const hotScanned = input.prospects.filter(
    (p) => p.lead_score === 'HOT' && p.scan_status === 'completed' && !p.archived_at,
  );
  if (hotScanned.length > 0) {
    const mrr = sumNullable(hotScanned.map((p) => p.estimated_mrr));
    items.push({
      id: 'hot-outreach',
      title: `${hotScanned.length} HOT prospect${hotScanned.length !== 1 ? 's' : ''} ready for outreach`,
      estimatedMrr: mrr,
      reason: 'Completed scans show elevated website risk.',
      action: 'Generate findings-based outreach',
      module: 'outreach',
    });
  }

  if (input.briefing.newSignups > 0) {
    items.push({
      id: 'new-signups',
      title: `${input.briefing.newSignups} new signup${input.briefing.newSignups !== 1 ? 's' : ''} need onboarding`,
      estimatedMrr: null,
      reason: 'Accounts created in the last 24 hours.',
      action: 'Send onboarding follow-up',
      module: 'customers',
    });
  }

  const trials = input.crmLeads.filter((l) => l.stage === 'trial' && !l.archived_at);
  if (trials.length > 0) {
    items.push({
      id: 'trial-followup',
      title: `${trials.length} trial lead${trials.length !== 1 ? 's' : ''} need follow-up`,
      estimatedMrr: sumNullable(trials.map((l) => l.potential_revenue)),
      reason: 'CRM trial stage — conversion window is open.',
      action: 'Schedule conversion call',
      module: 'crm',
    });
  }

  const demos = input.crmLeads.filter((l) => l.stage === 'demo' && !l.archived_at);
  if (demos.length > 0) {
    items.push({
      id: 'demo-pipeline',
      title: `${demos.length} demo lead${demos.length !== 1 ? 's' : ''} in pipeline`,
      estimatedMrr: sumNullable(demos.map((l) => l.potential_revenue)),
      reason: 'Demo-stage CRM entries with entered potential revenue.',
      action: 'Close demo leads',
      module: 'crm',
    });
  }

  const upgradeCandidates = input.prospects.filter(
    (p) => p.pipeline_state === 'interested' || p.pipeline_state === 'outreach_ready',
  );
  if (upgradeCandidates.length > 0) {
    items.push({
      id: 'warm-pipeline',
      title: `${upgradeCandidates.length} prospect${upgradeCandidates.length !== 1 ? 's' : ''} in outreach pipeline`,
      estimatedMrr: sumNullable(upgradeCandidates.map((p) => p.estimated_mrr)),
      reason: 'Prospects marked outreach-ready or interested.',
      action: 'Advance to customer stage',
      module: 'prospects',
    });
  }

  return items.slice(0, 6);
}

function buildFocusBlock(priorities: CeoPriority[], briefing: FounderBriefing): FocusStep[] {
  const steps: FocusStep[] = [];
  if (briefing.newSignups > 0) steps.push({ id: 'signup', label: 'Review new signup(s)' });
  if (briefing.hotProspects > 0) steps.push({ id: 'outreach', label: 'Send up to 5 outreach emails' });
  if (briefing.warmProspects > 0) steps.push({ id: 'warm', label: 'Follow up with warm prospects' });
  steps.push({ id: 'scans', label: 'Review today’s scan results' });
  steps.push({ id: 'crm', label: 'Log outcomes in CRM' });
  return steps.slice(0, 5);
}

export async function getCeoDashboard(input?: {
  prospects?: OwnerProspect[];
  crmLeads?: OwnerCrmLead[];
  briefing?: FounderBriefing;
  windows?: Record<TrendWindow, BusinessOverviewMetrics>;
  revenue?: RevenueOpportunitySummary;
  intelligence?: CustomerIntelligenceSummary;
}): Promise<CeoDashboard> {
  const admin = createAdminClient();
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const [prospectsRes, crmRes, profilesRes, todayOverview, windows, discoveryRes, emailFailRes, failedScanRes, hotTodayRes] =
    await Promise.all([
      input?.prospects
        ? Promise.resolve({ data: input.prospects })
        : admin.from('owner_prospects').select('*').is('deleted_at', null),
      input?.crmLeads
        ? Promise.resolve({ data: input.crmLeads })
        : admin.from('owner_crm_leads').select('*').is('deleted_at', null),
      admin.from('profiles').select('plan, subscription_status, created_at, churn_risk_score, email, is_qa_account'),
      getBusinessOverview('today'),
      input?.windows ?? getOverviewAllWindows(),
      admin
        .from('owner_discovery_runs')
        .select('error_message, inserted_count')
        .gte('created_at', dayAgo)
        .order('created_at', { ascending: false })
        .limit(3),
      admin
        .from('email_alert_logs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('created_at', dayAgo),
      admin
        .from('owner_prospects')
        .select('id', { count: 'exact', head: true })
        .eq('scan_status', 'failed')
        .gte('updated_at', dayAgo),
      admin
        .from('owner_prospects')
        .select('id', { count: 'exact', head: true })
        .eq('lead_score', 'HOT')
        .gte('created_at', dayAgo),
    ]);

  const prospects = prospectsRes.data ?? [];
  const crmLeads = crmRes.data ?? [];
  const profiles = (profilesRes.data ?? []).filter(
    (p) =>
      !isInternalCustomerProfile({
        email: (p as { email?: string }).email ?? '',
        is_qa_account: (p as { is_qa_account?: boolean }).is_qa_account ?? null,
        plan: (p.plan as string) ?? null,
      }),
  );
  const revenue = input?.revenue ?? buildRevenueOpportunity(prospects, crmLeads);

  const payingCustomers = profiles.filter(
    (p) =>
      p.subscription_status === 'active' &&
      p.plan &&
      p.plan !== 'free',
  ).length;
  const trialUsers = profiles.filter((p) => p.subscription_status === 'trialing').length;
  const churnRiskCount = profiles.filter((p) => (p.churn_risk_score ?? 0) > 70).length;

  const m30 = windows['30d'];
  const snapshot: CeoSnapshot = {
    mrr: m30.mrr,
    arr: m30.arr,
    payingCustomers,
    trialUsers,
    newSignupsToday: todayOverview.newSignups,
    scansToday: todayOverview.scans,
    conversionRate: todayOverview.conversionRate,
    churnRiskLevel: churnLevel(churnRiskCount),
    churnRiskCount,
    growth30dPct: m30.mrrGrowthPct,
  };

  const changesToday: TodayChange[] = [];
  if (todayOverview.newSignups > 0)
    changesToday.push({ label: 'New signups', value: todayOverview.newSignups });
  const newPaidToday = profiles.filter(
    (p) =>
      p.subscription_status === 'active' &&
      p.plan !== 'free' &&
      p.created_at &&
      new Date(p.created_at) >= new Date(dayAgo),
  ).length;
  if (newPaidToday > 0) changesToday.push({ label: 'New paying customers', value: newPaidToday });
  if (todayOverview.scans > 0) changesToday.push({ label: 'New scans', value: todayOverview.scans });
  if ((hotTodayRes.count ?? 0) > 0)
    changesToday.push({ label: 'New HOT prospects', value: hotTodayRes.count ?? 0 });

  const briefing: FounderBriefing = input?.briefing ?? {
    generatedAt: new Date().toISOString(),
    newCustomers: newPaidToday,
    newLeads: 0,
    newSignups: todayOverview.newSignups,
    scansToday: todayOverview.scans,
    revenueMrr: snapshot.mrr,
    revenueArr: snapshot.arr,
    churnRisk: churnRiskCount,
    hotProspects: prospects.filter((p) => p.lead_score === 'HOT').length,
    warmProspects: prospects.filter((p) => p.lead_score === 'WARM').length,
    opportunities: [],
    highlights: [],
    recommendedActions: [],
    topActions: [],
  };

  const opportunities = buildRevenueOpportunities({ prospects, crmLeads, briefing });
  const priorities = buildCeoPriorities({ briefing, prospects, crmLeads, revenue });

  const warnings: BusinessWarning[] = [];
  if ((failedScanRes.count ?? 0) > 0) {
    warnings.push({
      id: 'failed-scans',
      severity: 'warning',
      message: `${failedScanRes.count} prospect scan(s) failed in the last 24 hours`,
      module: 'prospects',
      action: 'Review scans',
    });
  }
  if ((emailFailRes.count ?? 0) > 0) {
    warnings.push({
      id: 'email-fail',
      severity: 'critical',
      message: `${emailFailRes.count} email delivery failure(s) in the last 24 hours`,
      action: 'Check email config',
    });
  }
  const signups7d = windows['7d'].newSignups;
  if (signups7d === 0 && profiles.length > 1) {
    warnings.push({
      id: 'no-signups',
      severity: 'warning',
      message: 'No new signups in the last 7 days',
      action: 'Review acquisition',
    });
  }
  if (churnRiskCount >= 3) {
    warnings.push({
      id: 'churn',
      severity: 'critical',
      message: `${churnRiskCount} accounts at elevated churn risk`,
      module: 'customers',
      action: 'Review retention',
    });
  }
  const discoveryFails = (discoveryRes.data ?? []).filter((r) => r.error_message);
  if (discoveryFails.length > 0 && discoveryFails.every((r) => (r.inserted_count ?? 0) === 0)) {
    warnings.push({
      id: 'discovery',
      severity: 'warning',
      message: 'Prospect discovery ran but inserted no new prospects',
      module: 'prospects',
      action: 'Review discovery',
    });
  }

  const mrrGap = Math.max(0, 1000 - snapshot.mrr);
  const next1kSteps: string[] = [];
  if (mrrGap > 0) {
    if (opportunities.some((o) => o.id === 'hot-outreach')) {
      next1kSteps.push('Close 2–3 HOT prospects via findings-based outreach');
    }
    if (trialUsers > 0) next1kSteps.push(`Convert ${trialUsers} trial user(s) to paid`);
    if (demoTrialCount(crmLeads) > 0) next1kSteps.push('Close demo-stage CRM leads with entered pipeline value');
    if (next1kSteps.length === 0) next1kSteps.push('Acquire first paying customers via onboarding and outreach');
  } else {
    next1kSteps.push('MRR exceeds $1,000 — focus on retention and expansion');
  }

  const revenueAtRiskItems: string[] = [];
  if (churnRiskCount > 0) revenueAtRiskItems.push(`${churnRiskCount} account(s) with churn risk > 70`);
  if (trialUsers > 0) revenueAtRiskItems.push(`${trialUsers} trial user(s) without conversion`);
  if (todayOverview.newSignups > 0 && newPaidToday === 0) {
    revenueAtRiskItems.push(`${todayOverview.newSignups} new signup(s) not yet converted`);
  }

  return {
    generatedAt: new Date().toISOString(),
    snapshot,
    interpretation: interpretSnapshot(snapshot),
    changesToday,
    opportunities,
    priorities,
    focusBlock: buildFocusBlock(priorities, briefing),
    warnings,
    nextAction: priorities[0] ?? null,
    revenueAtRisk: {
      summary:
        revenueAtRiskItems.length > 0
          ? 'Revenue may be at risk from churn, trials, or unconverted signups.'
          : 'No major revenue risks detected from platform data.',
      items: revenueAtRiskItems,
    },
    next1kPath: {
      summary:
        mrrGap > 0
          ? `~$${mrrGap.toLocaleString()} MRR to reach the next $1,000 milestone`
          : 'You are past $1,000 MRR — optimize retention and expansion.',
      steps: next1kSteps.slice(0, 4),
    },
  };
}

function demoTrialCount(crmLeads: OwnerCrmLead[]): number {
  return crmLeads.filter((l) => l.stage === 'demo' || l.stage === 'trial').length;
}
