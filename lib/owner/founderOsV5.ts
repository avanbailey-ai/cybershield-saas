import { createAdminClient } from '@/lib/supabase/admin';
import { getBusinessOverview } from './metrics';
import { getCustomerIntelligence } from './customerIntelligence';
import type { OwnerProspect, OwnerCrmLead } from './types';
import { planFitDisplayName } from './salesIntelligence';
import { hasOutreachContact, resolveProspectList } from './prospectDisplay';
import { isInternalCustomerProfile } from './internalAccountFilters';

const DEFAULT_MRR_GOAL = 1000;

export interface FounderInboxItem {
  id: string;
  type:
    | 'outreach'
    | 'customer_risk'
    | 'expansion'
    | 'signup'
    | 'follow_up'
    | 'interested'
    | 'failed_email';
  title: string;
  description: string;
  action: string;
  module: 'inbox' | 'prospects' | 'customers' | 'success' | 'outreach';
  whyItMatters?: string;
  revenueImpact?: number | null;
  meta?: Record<string, unknown>;
}

export interface FounderOsV5Data {
  generatedAt: string;
  chiefOfStaff: {
    greeting: string;
    bullets: string[];
    focus: string;
    upside: string | null;
  };
  businessStatus: {
    mrr: number;
    arr: number;
    payingCustomers: number;
    activeTrials: number;
    customerGrowthPct: number;
    churnRisk: 'Low' | 'Medium' | 'High';
    churnRiskCount: number;
    mrrGoal: number;
    goalProgressPct: number;
    daysToGoal: number | null;
  };
  whileAway: { label: string; value: number }[];
  autopilot: {
    outreachDrafts: number;
    followUps: number;
    expansionOpportunities: number;
    items: FounderInboxItem[];
  };
  biggestOpportunity: {
    id: string;
    businessName: string;
    opportunityScore: number;
    securityScore: number | null;
    estimatedMrr: number | null;
    planFit: string | null;
    reasons: string[];
    recommendedAction: string;
  } | null;
  customerSuccess: {
    healthy: number;
    needsAttention: number;
    expansionOpportunities: number;
    potentialExpansionMrr: number;
    atRisk: { name: string; reason: string }[];
    expansions: { name: string; from: string; to: string; mrr: number }[];
  };
  revenueEngine: {
    targetMrr: number;
    summary: string;
    paths: { label: string; count: number; mrrEach: number }[];
    probability: 'High' | 'Medium' | 'Low';
    requiredActions: number;
  };
  pipeline: {
    stages: { id: string; label: string; count: number }[];
    bottleneck: string | null;
  };
  marketIntelligence: {
    topFinding: string | null;
    bestIndustry: string | null;
    industryInsight: string | null;
    avgSecurityScore: number | null;
  };
  inbox: FounderInboxItem[];
}

export const EMPTY_FOUNDER_OS_V5: FounderOsV5Data = {
  generatedAt: new Date(0).toISOString(),
  chiefOfStaff: {
    greeting: 'Good morning.',
    bullets: ['Connect live data to activate Founder OS V5.'],
    focus: 'Review business status',
    upside: null,
  },
  businessStatus: {
    mrr: 0,
    arr: 0,
    payingCustomers: 0,
    activeTrials: 0,
    customerGrowthPct: 0,
    churnRisk: 'Low',
    churnRiskCount: 0,
    mrrGoal: DEFAULT_MRR_GOAL,
    goalProgressPct: 0,
    daysToGoal: null,
  },
  whileAway: [],
  autopilot: { outreachDrafts: 0, followUps: 0, expansionOpportunities: 0, items: [] },
  biggestOpportunity: null,
  customerSuccess: {
    healthy: 0,
    needsAttention: 0,
    expansionOpportunities: 0,
    potentialExpansionMrr: 0,
    atRisk: [],
    expansions: [],
  },
  revenueEngine: {
    targetMrr: 500,
    summary: 'No revenue path yet',
    paths: [],
    probability: 'Low',
    requiredActions: 0,
  },
  pipeline: { stages: [], bottleneck: null },
  marketIntelligence: {
    topFinding: null,
    bestIndustry: null,
    industryInsight: null,
    avgSecurityScore: null,
  },
  inbox: [],
};

function daysToReachGoal(current: number, goal: number, dailyPace: number): number | null {
  if (current >= goal || dailyPace <= 0) return null;
  return Math.ceil((goal - current) / dailyPace);
}

const PIPELINE_V5 = [
  { id: 'discovered', label: 'Discovered', states: ['new', 'new_discovery', 'scanned'] },
  { id: 'qualified', label: 'Qualified', states: ['qualified'] },
  { id: 'outreach_ready', label: 'Outreach Ready', states: ['outreach_ready'] },
  { id: 'contacted', label: 'Contacted', states: ['contacted'] },
  { id: 'interested', label: 'Interested', states: ['interested'] },
  { id: 'trial', label: 'Trial', states: [] as string[] },
  { id: 'customer', label: 'Customer', states: ['customer'] },
  { id: 'lost', label: 'Lost', states: [] as string[] },
  { id: 'archived', label: 'Archived', states: ['archived', 'ignore_forever'] },
] as const;

export async function getFounderOsV5(input?: {
  prospects?: OwnerProspect[];
  crmLeads?: OwnerCrmLead[];
}): Promise<FounderOsV5Data> {
  const admin = createAdminClient();
  const dayAgo = new Date(Date.now() - 86400000).toISOString();

  const [
    prospectsRes,
    crmRes,
    overview30,
    overview7,
    intelligence,
    profilesRes,
    draftsRes,
    discoveryRes,
    scans24Res,
    signups24Res,
    websitesRes,
    goalRes,
  ] = await Promise.all([
    input?.prospects
      ? Promise.resolve({ data: input.prospects })
      : admin
          .from('owner_prospects')
          .select('*')
          .is('deleted_at', null)
          .not('pipeline_state', 'eq', 'archived')
          .not('pipeline_state', 'eq', 'ignore_forever'),
    input?.crmLeads
      ? Promise.resolve({ data: input.crmLeads })
      : admin.from('owner_crm_leads').select('*').is('deleted_at', null),
    getBusinessOverview('30d'),
    getBusinessOverview('7d'),
    getCustomerIntelligence(),
    admin.from('profiles').select('id, plan, subscription_status, churn_risk_score, updated_at, email, is_qa_account'),
    admin
      .from('owner_outreach_drafts')
      .select('*')
      .eq('status', 'draft')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(20),
    admin
      .from('owner_discovery_runs')
      .select('inserted_count, qualified_count, outreach_ready_count')
      .gte('created_at', dayAgo),
    admin
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', dayAgo),
    admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', dayAgo),
    admin.from('websites').select('user_id, url'),
    admin
      .from('owner_founder_settings')
      .select('value')
      .eq('key', 'mrr_goal')
      .maybeSingle(),
  ]);

  const prospects = (prospectsRes.data ?? []) as OwnerProspect[];
  const crmLeads = (crmRes.data ?? []) as OwnerCrmLead[];
  const profiles = profilesRes.data ?? [];
  const drafts = draftsRes.data ?? [];
  const websites = websitesRes.data ?? [];

  const mrrGoal =
    typeof goalRes.data?.value === 'object' &&
    goalRes.data?.value &&
    'amount' in (goalRes.data.value as object)
      ? Number((goalRes.data.value as { amount: number }).amount)
      : DEFAULT_MRR_GOAL;

  const payingCustomers = profiles.filter(
    (p) =>
      !isInternalCustomerProfile({
        email: (p.email as string) ?? '',
        is_qa_account: (p as { is_qa_account?: boolean }).is_qa_account ?? null,
        plan: (p.plan as string) ?? null,
      }) &&
      p.subscription_status === 'active' &&
      p.plan &&
      p.plan !== 'free' &&
      p.plan !== 'owner',
  ).length;
  const activeTrials = profiles.filter(
    (p) =>
      !isInternalCustomerProfile({
        email: (p.email as string) ?? '',
        is_qa_account: (p as { is_qa_account?: boolean }).is_qa_account ?? null,
        plan: (p.plan as string) ?? null,
      }) &&
      p.subscription_status === 'trialing',
  ).length;
  const churnRiskCount = profiles.filter(
    (p) =>
      !isInternalCustomerProfile({
        email: (p.email as string) ?? '',
        is_qa_account: (p as { is_qa_account?: boolean }).is_qa_account ?? null,
        plan: (p.plan as string) ?? null,
      }) &&
      (p.churn_risk_score ?? 0) > 70,
  ).length;
  const churnRisk: 'Low' | 'Medium' | 'High' =
    churnRiskCount >= 5 ? 'High' : churnRiskCount >= 2 ? 'Medium' : 'Low';

  const goalProgressPct =
    mrrGoal > 0 ? Math.min(100, Math.round((overview30.mrr / mrrGoal) * 100)) : 0;
  const dailyPace = overview7.mrr > overview30.mrr ? (overview7.mrr - overview30.mrr) / 7 : 0;
  const daysToGoal = daysToReachGoal(overview30.mrr, mrrGoal, dailyPace);

  const discovered24 = (discoveryRes.data ?? []).reduce(
    (s, r) => s + (r.inserted_count ?? 0),
    0,
  );
  const qualified24 = (discoveryRes.data ?? []).reduce(
    (s, r) => s + (r.qualified_count ?? 0),
    0,
  );
  const outreachReady24 = prospects.filter(
    (p) => p.pipeline_state === 'outreach_ready' && p.updated_at >= dayAgo,
  ).length;
  const drafts24 = drafts.filter((d) => (d.created_at as string) >= dayAgo).length;
  const trialCrm = crmLeads.filter((l) => l.stage === 'trial').length;

  const whileAway: { label: string; value: number }[] = [
    { label: 'Discovered businesses', value: discovered24 },
    { label: 'Completed scans', value: scans24Res.count ?? 0 },
    { label: 'Qualified opportunities', value: qualified24 },
    { label: 'Outreach drafts generated', value: drafts.length },
    { label: 'New signups', value: signups24Res.count ?? 0 },
    { label: 'Moved to outreach-ready', value: outreachReady24 },
  ].filter((x) => x.value > 0);

  const resolvedProspects = resolveProspectList(prospects);
  const top = [...resolvedProspects]
    .filter((p) => {
      if (p.pipeline_state === 'archived' || p.pipeline_state === 'ignore_forever') return false;
      return (p.opportunity_score ?? 0) >= 25;
    })
    .sort((a, b) => {
      const aReady = hasOutreachContact(a) && a.pipeline_state === 'outreach_ready' ? 1000 : 0;
      const bReady = hasOutreachContact(b) && b.pipeline_state === 'outreach_ready' ? 1000 : 0;
      if (bReady !== aReady) return bReady - aReady;
      return (b.opportunity_score ?? 0) - (a.opportunity_score ?? 0);
    })[0];

  const biggestOpportunity = top
    ? {
        id: top.id,
        businessName: top.business_name,
        opportunityScore: top.opportunity_score ?? 0,
        securityScore: top.scan_score,
        estimatedMrr: top.estimated_plan_fit,
        planFit: planFitDisplayName(top.estimated_plan_fit),
        reasons: Array.isArray(top.qualification_reasons)
          ? top.qualification_reasons.slice(0, 5)
          : [],
        recommendedAction:
          top.pipeline_state === 'outreach_ready' && hasOutreachContact(top)
            ? 'Approve outreach'
            : !hasOutreachContact(top)
              ? 'Find contact info'
              : top.scan_status !== 'completed'
                ? 'Run qualification scan'
                : 'Review in prospects',
      }
    : null;

  const websitesByUser = new Map<string, number>();
  for (const w of websites) {
    const uid = w.user_id as string;
    websitesByUser.set(uid, (websitesByUser.get(uid) ?? 0) + 1);
  }

  const atRisk: { name: string; reason: string }[] = [];
  const expansions: { name: string; from: string; to: string; mrr: number }[] = [];
  let potentialExpansionMrr = 0;

  for (const p of profiles) {
    if ((p.churn_risk_score ?? 0) > 70) {
      atRisk.push({
        name: (p.email as string) ?? 'Customer',
        reason: 'Elevated churn risk score',
      });
    }
    const siteCount = websitesByUser.get(p.id as string) ?? 0;
    const plan = (p.plan as string) ?? 'free';
    if (p.subscription_status === 'active' && siteCount >= 3 && plan === 'pro') {
      expansions.push({
        name: (p.email as string) ?? 'Customer',
        from: 'Starter',
        to: 'Growth',
        mrr: 70,
      });
      potentialExpansionMrr += 70;
    } else if (p.subscription_status === 'active' && siteCount >= 5 && plan === 'growth') {
      expansions.push({
        name: (p.email as string) ?? 'Customer',
        from: 'Growth',
        to: 'Agency',
        mrr: 150,
      });
      potentialExpansionMrr += 150;
    }
  }

  const healthy = profiles.filter(
    (p) =>
      p.subscription_status === 'active' &&
      (p.churn_risk_score ?? 0) <= 50 &&
      p.plan !== 'free',
  ).length;
  const needsAttention = atRisk.length + profiles.filter((p) => {
    const ts = p.updated_at as string | undefined;
    if (!ts || p.subscription_status !== 'active') return false;
    return Date.now() - new Date(ts).getTime() > 30 * 86400000;
  }).length;

  const outreachReady = prospects.filter((p) => p.pipeline_state === 'outreach_ready');
  const starterCount = outreachReady.filter((p) => p.estimated_plan_fit === 79).length;
  const growthCount = outreachReady.filter((p) => p.estimated_plan_fit === 149).length;
  const paths = [
    { label: 'Starter customers', count: starterCount, mrrEach: 79 },
    { label: 'Growth customers', count: growthCount, mrrEach: 149 },
  ].filter((p) => p.count > 0);

  const targetMrr = 500;
  const revenueEngine = {
    targetMrr,
    summary:
      paths.length > 0
        ? `Next $${targetMrr} MRR from outreach-ready pipeline`
        : 'Build outreach-ready pipeline to unlock next revenue block',
    paths,
    probability: (outreachReady.length >= 3
      ? 'High'
      : outreachReady.length >= 1
        ? 'Medium'
        : 'Low') as 'High' | 'Medium' | 'Low',
    requiredActions: Math.min(5, outreachReady.length + drafts.length),
  };

  const stages = PIPELINE_V5.map((s) => {
    let count = prospects.filter((p) =>
      (s.states as readonly string[]).includes(p.pipeline_state ?? ''),
    ).length;
    if (s.id === 'trial') count = trialCrm;
    if (s.id === 'lost') count = crmLeads.filter((l) => l.stage === 'lost').length;
    return { id: s.id, label: s.label, count };
  });

  const stagePairs = [
    ['discovered', 'qualified'],
    ['qualified', 'outreach_ready'],
    ['outreach_ready', 'contacted'],
  ] as const;
  let bottleneck: string | null = null;
  for (const [from, to] of stagePairs) {
    const fromCount = stages.find((s) => s.id === from)?.count ?? 0;
    const toCount = stages.find((s) => s.id === to)?.count ?? 0;
    if (fromCount >= 3 && toCount === 0) {
      bottleneck = `Prospects stalling at ${stages.find((s) => s.id === from)?.label}`;
      break;
    }
  }

  const inbox: FounderInboxItem[] = [];

  for (const d of drafts.slice(0, 5)) {
    inbox.push({
      id: `draft-${d.id}`,
      type: 'outreach',
      title: `Approve outreach: ${d.business_name ?? 'Prospect'}`,
      description: 'Findings-based email draft ready to send via Resend.',
      whyItMatters: 'Qualified prospect with contact — outreach converts pipeline to revenue.',
      revenueImpact: null,
      action: 'Approve & Send',
      module: 'inbox',
      meta: { draftId: d.id },
    });
  }

  for (const r of atRisk.slice(0, 3)) {
    inbox.push({
      id: `risk-${r.name}`,
      type: 'customer_risk',
      title: `Customer at risk: ${r.name}`,
      description: r.reason,
      action: 'Review',
      module: 'customers',
    });
  }

  for (const e of expansions.slice(0, 2)) {
    inbox.push({
      id: `exp-${e.name}`,
      type: 'expansion',
      title: `Expansion: ${e.name}`,
      description: `Recommend ${e.from} → ${e.to} (+$${e.mrr}/mo)`,
      action: 'Review offer',
      module: 'customers',
      meta: { mrr: e.mrr },
    });
  }

  if ((signups24Res.count ?? 0) > 0) {
    inbox.push({
      id: 'signup-latest',
      type: 'signup',
      title: `${signups24Res.count} new signup(s) in last 24h`,
      description: 'Review onboarding path for new users.',
      action: 'Review',
      module: 'customers',
    });
  }

  const bestIndustry = intelligence.topIndustries[0]?.name ?? null;
  const industryInsight =
    intelligence.topIndustries.length >= 2
      ? `${intelligence.topIndustries[0].name} has ${intelligence.topIndustries[0].count} leads in pipeline — prioritize discovery here.`
      : null;

  const bullets: string[] = [];
  if ((signups24Res.count ?? 0) > 0) {
    bullets.push(`CyberShield gained ${signups24Res.count} signup(s) in the last 24 hours.`);
  }
  if (qualified24 > 0) {
    bullets.push(`${qualified24} new qualified opportunities were identified.`);
  }
  if (biggestOpportunity) {
    bullets.push(`${biggestOpportunity.businessName} is the highest-scoring opportunity.`);
  }
  if (expansions.length > 0) {
    bullets.push(`${expansions.length} customer(s) may be ready for an upgrade.`);
  }
  if (bullets.length === 0) {
    bullets.push('No major overnight changes. Run discovery to feed the revenue engine.');
  }

  const focus =
    outreachReady.length > 0
      ? 'Approve outreach for outreach-ready prospects'
      : qualified24 > 0
        ? 'Qualify new discoveries for outreach'
        : 'Run targeted discovery';

  const upside =
    potentialExpansionMrr > 0 || outreachReady.length > 0
      ? `+$${potentialExpansionMrr + outreachReady.reduce((s, p) => s + (p.estimated_plan_fit ?? 0), 0)} MRR potential in pipeline`
      : null;

  return {
    generatedAt: new Date().toISOString(),
    chiefOfStaff: {
      greeting: 'Good morning, Avan.',
      bullets,
      focus,
      upside,
    },
    businessStatus: {
      mrr: overview30.mrr,
      arr: overview30.arr,
      payingCustomers,
      activeTrials,
      customerGrowthPct: overview30.mrrGrowthPct,
      churnRisk,
      churnRiskCount,
      mrrGoal,
      goalProgressPct,
      daysToGoal,
    },
    whileAway,
    autopilot: {
      outreachDrafts: drafts.length,
      followUps: prospects.filter((p) => p.pipeline_state === 'contacted').length,
      expansionOpportunities: expansions.length,
      items: inbox.filter((i) => i.type === 'outreach' || i.type === 'expansion'),
    },
    biggestOpportunity,
    customerSuccess: {
      healthy,
      needsAttention,
      expansionOpportunities: expansions.length,
      potentialExpansionMrr,
      atRisk: atRisk.slice(0, 5),
      expansions: expansions.slice(0, 5),
    },
    revenueEngine,
    pipeline: { stages, bottleneck },
    marketIntelligence: {
      topFinding: intelligence.commonFindings[0]?.finding ?? null,
      bestIndustry,
      industryInsight,
      avgSecurityScore:
        intelligence.avgRiskScore > 0 ? Math.round(intelligence.avgRiskScore) : null,
    },
    inbox,
  };
}
