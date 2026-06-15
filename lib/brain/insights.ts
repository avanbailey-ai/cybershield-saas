import { createAdminClient } from '@/lib/supabase/admin';

export interface BusinessInsights {
  weakestFunnelStage: string;
  highestConvertingSource: string;
  bestPerformingCta: string;
  worstDropoffPoint: string;
  revenueLeakagePoints: string[];
  viralLoopConversionRate: number;
  enterpriseLeadConversionRate: number;
  generatedAt: string;
}

const FUNNEL_STEPS = [
  'scan_started',
  'scan_completed',
  'paywall_viewed',
  'upgrade_clicked',
  'checkout_started',
  'checkout_completed',
] as const;

interface FunnelCounts {
  [key: string]: number;
}

async function loadUnifiedEvents(days: number) {
  const admin = createAdminClient();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [systemRes, analyticsRes] = await Promise.all([
    admin
      .from('system_events')
      .select('event_type, session_id, source, metadata')
      .gte('created_at', since.toISOString()),
    admin
      .from('analytics_events')
      .select('event_type, session_id, metadata')
      .gte('created_at', since.toISOString()),
  ]);

  return [...(systemRes.data ?? []), ...(analyticsRes.data ?? [])];
}

function computeFunnelCounts(
  events: { event_type: string; session_id: string | null }[],
): FunnelCounts {
  const sessionSets = new Map<string, Set<string>>();
  for (const row of events) {
    const sid = row.session_id ?? 'unknown';
    if (!sessionSets.has(sid)) sessionSets.set(sid, new Set());
    sessionSets.get(sid)!.add(row.event_type);
  }

  const counts: FunnelCounts = {};
  for (const step of FUNNEL_STEPS) counts[step] = 0;
  for (const types of sessionSets.values()) {
    for (const step of FUNNEL_STEPS) {
      if (types.has(step)) counts[step]++;
    }
  }
  return counts;
}

function findWeakestStage(counts: FunnelCounts): { stage: string; dropoff: number } {
  let worst: { stage: string; dropoff: number } = { stage: FUNNEL_STEPS[0], dropoff: 0 };
  for (let i = 1; i < FUNNEL_STEPS.length; i++) {
    const prev = counts[FUNNEL_STEPS[i - 1]];
    const curr = counts[FUNNEL_STEPS[i]];
    if (prev > 0) {
      const dropoff = ((prev - curr) / prev) * 100;
      if (dropoff > worst.dropoff) {
        worst = { stage: FUNNEL_STEPS[i], dropoff };
      }
    }
  }
  return worst;
}

function computeSourceConversion(
  events: { event_type: string; source?: string | null }[],
): string {
  const bySource = new Map<string, { started: number; completed: number }>();
  for (const row of events) {
    const src = row.source ?? 'app';
    if (!bySource.has(src)) bySource.set(src, { started: 0, completed: 0 });
    const bucket = bySource.get(src)!;
    if (row.event_type === 'scan_started') bucket.started++;
    if (row.event_type === 'checkout_completed') bucket.completed++;
  }

  let best = 'app';
  let bestRate = 0;
  for (const [src, { started, completed }] of bySource) {
    if (started > 0) {
      const rate = completed / started;
      if (rate > bestRate) {
        bestRate = rate;
        best = src;
      }
    }
  }
  return best;
}

function computeCtaPerformance(
  events: { event_type: string; metadata?: Record<string, unknown> | null }[],
): string {
  const ctaCounts = new Map<string, number>();
  for (const row of events) {
    if (row.event_type === 'upgrade_clicked') {
      const cta = String((row.metadata as { cta?: string })?.cta ?? 'default');
      ctaCounts.set(cta, (ctaCounts.get(cta) ?? 0) + 1);
    }
  }
  let best = 'default';
  let max = 0;
  for (const [cta, count] of ctaCounts) {
    if (count > max) {
      max = count;
      best = cta;
    }
  }
  return best;
}

function identifyRevenueLeakage(counts: FunnelCounts): string[] {
  const leaks: string[] = [];
  for (let i = 1; i < FUNNEL_STEPS.length; i++) {
    const prev = counts[FUNNEL_STEPS[i - 1]];
    const curr = counts[FUNNEL_STEPS[i]];
    if (prev > 0 && (prev - curr) / prev > 0.4) {
      leaks.push(`${FUNNEL_STEPS[i - 1]} → ${FUNNEL_STEPS[i]}`);
    }
  }
  if (leaks.length === 0 && counts.checkout_started > counts.checkout_completed) {
    leaks.push('checkout_started → checkout_completed');
  }
  return leaks;
}

export async function generateBusinessInsights(days = 30): Promise<BusinessInsights> {
  const admin = createAdminClient();
  const events = await loadUnifiedEvents(days);
  const counts = computeFunnelCounts(events);
  const weakest = findWeakestStage(counts);

  const since = new Date();
  since.setDate(since.getDate() - days);

  const [viralRes, leadsRes, referralsRes, profilesRes] = await Promise.all([
    admin
      .from('viral_events')
      .select('event_type')
      .gte('created_at', since.toISOString()),
    admin
      .from('enterprise_leads')
      .select('status')
      .gte('created_at', since.toISOString()),
    admin.from('profiles').select('id, referred_by_code').gte('created_at', since.toISOString()),
    admin.from('profiles').select('id', { count: 'exact', head: true }),
  ]);

  const viralEvents = viralRes.data ?? [];
  const referralClicks = viralEvents.filter((e) => e.event_type === 'referral_clicked').length;
  const referralConverted = viralEvents.filter((e) => e.event_type === 'referral_converted').length;
  const viralLoopConversionRate =
    referralClicks > 0 ? Math.round((referralConverted / referralClicks) * 1000) / 10 : 0;

  const leads = leadsRes.data ?? [];
  const qualifiedLeads = leads.filter((l) => l.status === 'qualified' || l.status === 'closed').length;
  const enterpriseLeadConversionRate =
    leads.length > 0 ? Math.round((qualifiedLeads / leads.length) * 1000) / 10 : 0;

  const signups = (referralsRes.data ?? []).length;
  const referredSignups = (referralsRes.data ?? []).filter((p) => p.referred_by_code).length;

  const insights: BusinessInsights = {
    weakestFunnelStage: weakest.stage,
    highestConvertingSource: computeSourceConversion(
      events as { event_type: string; source?: string | null }[],
    ),
    bestPerformingCta: computeCtaPerformance(
      events as { event_type: string; metadata?: Record<string, unknown> | null }[],
    ),
    worstDropoffPoint: `${weakest.stage} (${Math.round(weakest.dropoff)}% dropoff)`,
    revenueLeakagePoints: identifyRevenueLeakage(counts),
    viralLoopConversionRate:
      signups > 0 ? Math.round((referredSignups / signups) * 1000) / 10 : viralLoopConversionRate,
    enterpriseLeadConversionRate,
    generatedAt: new Date().toISOString(),
  };

  await admin.from('brain_insights').insert({ insights });

  return insights;
}

export async function getLatestInsights(): Promise<BusinessInsights | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('brain_insights')
    .select('insights')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.insights as BusinessInsights) ?? null;
}

export { FUNNEL_STEPS, computeFunnelCounts, loadUnifiedEvents };
