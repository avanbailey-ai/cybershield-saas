import { createAdminClient } from '@/lib/supabase/admin';
import { computeConversionIntentScore } from '@/lib/analytics/conversionScore';
import { computeLeadScore, detectEnterpriseIntentFromEvents } from '@/lib/sales/intent';
import { computeChurnRisk } from './churn';

export type FunnelStage = 'anonymous' | 'scanned' | 'engaged' | 'checkout' | 'paid';
export type RecommendedAction =
  | 'scan_cta'
  | 'upgrade'
  | 'enterprise_demo'
  | 'retention'
  | 'none';

export interface UserBrainState {
  intentScore: number;
  churnRisk: number;
  funnelStage: FunnelStage;
  recommendedAction: RecommendedAction;
}

function deriveFunnelStage(
  events: { event_type: string }[],
  plan: string | null,
): FunnelStage {
  if (plan && plan !== 'free') return 'paid';
  const types = new Set(events.map((e) => e.event_type));
  if (types.has('checkout_started') || types.has('checkout_completed')) return 'checkout';
  if (types.has('upgrade_clicked') || types.has('paywall_viewed')) return 'engaged';
  if (types.has('scan_completed') || types.has('scan_started')) return 'scanned';
  return 'anonymous';
}

function deriveRecommendedAction(
  state: {
    intentScore: number;
    churnRisk: number;
    funnelStage: FunnelStage;
    enterpriseIntent: number;
    plan: string | null;
  },
): RecommendedAction {
  if (state.plan && state.plan !== 'free' && state.churnRisk > 60) {
    return 'retention';
  }

  if (state.enterpriseIntent >= 70) {
    return 'enterprise_demo';
  }

  if (state.funnelStage === 'checkout' || state.intentScore >= 70) {
    return 'upgrade';
  }

  if (state.funnelStage === 'anonymous' || state.funnelStage === 'scanned') {
    return 'scan_cta';
  }

  if (state.funnelStage === 'engaged') {
    return 'upgrade';
  }

  return 'none';
}

export async function getUserBrainState(
  userId?: string,
  sessionId?: string,
): Promise<UserBrainState> {
  const admin = createAdminClient();

  let events: { event_type: string; metadata?: Record<string, unknown> | null }[] = [];
  let plan: string | null = null;
  let churnRisk = 0;

  if (sessionId) {
    const [sysRes, anaRes] = await Promise.all([
      admin.from('system_events').select('event_type, metadata').eq('session_id', sessionId),
      admin.from('analytics_events').select('event_type, metadata').eq('session_id', sessionId),
    ]);
    events = [...(sysRes.data ?? []), ...(anaRes.data ?? [])];
  }

  if (userId) {
    const { data: profile } = await admin
      .from('profiles')
      .select('plan, churn_risk_score, last_active_at')
      .eq('id', userId)
      .maybeSingle();

    plan = profile?.plan ?? null;
    churnRisk = profile?.churn_risk_score ?? 0;

    if (events.length === 0) {
      const [sysRes, anaRes] = await Promise.all([
        admin.from('system_events').select('event_type, metadata').eq('user_id', userId),
        admin.from('analytics_events').select('event_type, metadata').eq('user_id', userId),
      ]);
      events = [...(sysRes.data ?? []), ...(anaRes.data ?? [])];
    }

    if (churnRisk === 0 && plan && plan !== 'free') {
      const { data: lastScan } = await admin
        .from('scans')
        .select('completed_at')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const now = new Date();
      const lastActive = profile?.last_active_at ? new Date(profile.last_active_at) : now;
      const lastScanDate = lastScan?.completed_at ? new Date(lastScan.completed_at) : null;

      churnRisk = computeChurnRisk({
        daysSinceLastScan: lastScanDate
          ? Math.floor((now.getTime() - lastScanDate.getTime()) / 86400000)
          : 30,
        daysSinceLastLogin: Math.floor((now.getTime() - lastActive.getTime()) / 86400000),
        scansLast30Days: 0,
        plan: plan ?? 'pro',
      });
    }
  }

  const intentScore = computeConversionIntentScore(
    events.map((e) => ({
      event_type: e.event_type,
      metadata: (e.metadata ?? {}) as Record<string, unknown>,
    })),
  );

  const funnelStage = deriveFunnelStage(events, plan);

  const enterpriseSignals = sessionId
    ? await detectEnterpriseIntentFromEvents(sessionId)
    : { pricingVisits: 0, scanCount: 0, enterprisePageViews: 0 };

  const enterpriseIntent = computeLeadScore({ analyticsSignals: enterpriseSignals });

  const recommendedAction = deriveRecommendedAction({
    intentScore,
    churnRisk,
    funnelStage,
    enterpriseIntent,
    plan,
  });

  return { intentScore, churnRisk, funnelStage, recommendedAction };
}
