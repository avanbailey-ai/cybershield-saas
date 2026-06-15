/**
 * CEO funnel analysis — extended conversion stages.
 * Reads unified events from system_events + analytics_events.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export const CEO_FUNNEL_STAGES = [
  'landing_view',
  'scan_started',
  'scan_completed',
  'report_viewed',
  'pricing_viewed',
  'checkout_started',
  'checkout_completed',
] as const;

export type CeoFunnelStage = (typeof CEO_FUNNEL_STAGES)[number];

/** Map canonical stage to accepted event_type aliases in the warehouse. */
const STAGE_ALIASES: Record<CeoFunnelStage, string[]> = {
  landing_view: ['landing_view', 'page_view'],
  scan_started: ['scan_started'],
  scan_completed: ['scan_completed'],
  report_viewed: ['report_viewed'],
  pricing_viewed: ['pricing_viewed', 'paywall_viewed'],
  checkout_started: ['checkout_started'],
  checkout_completed: ['checkout_completed'],
};

export interface FunnelDropoff {
  stage: string;
  count: number;
  dropoffPct: number;
}

export interface UnifiedEvent {
  event_type: string;
  session_id: string | null;
}

function sessionReachedStage(types: Set<string>, stage: CeoFunnelStage): boolean {
  return STAGE_ALIASES[stage].some((alias) => types.has(alias));
}

export function computeFunnelDropoffs(
  events: UnifiedEvent[],
  _windowDays?: number,
): FunnelDropoff[] {
  const sessionSets = new Map<string, Set<string>>();
  for (const row of events) {
    const sid = row.session_id ?? 'unknown';
    if (!sessionSets.has(sid)) sessionSets.set(sid, new Set());
    sessionSets.get(sid)!.add(row.event_type);
  }

  const counts: Record<CeoFunnelStage, number> = {
    landing_view: 0,
    scan_started: 0,
    scan_completed: 0,
    report_viewed: 0,
    pricing_viewed: 0,
    checkout_started: 0,
    checkout_completed: 0,
  };

  for (const types of sessionSets.values()) {
    for (const stage of CEO_FUNNEL_STAGES) {
      if (sessionReachedStage(types, stage)) counts[stage]++;
    }
  }

  return CEO_FUNNEL_STAGES.map((stage, i) => {
    const count = counts[stage];
    const prevCount = i > 0 ? counts[CEO_FUNNEL_STAGES[i - 1]] : count;
    const dropoffPct =
      i > 0 && prevCount > 0
        ? Math.round(((prevCount - count) / prevCount) * 1000) / 10
        : 0;
    return { stage, count, dropoffPct };
  });
}

export async function loadUnifiedEventsForWindow(
  since: Date,
  until?: Date,
): Promise<UnifiedEvent[]> {
  const admin = createAdminClient();
  const untilIso = until?.toISOString() ?? new Date().toISOString();

  const [systemRes, analyticsRes] = await Promise.all([
    admin
      .from('system_events')
      .select('event_type, session_id')
      .gte('created_at', since.toISOString())
      .lte('created_at', untilIso),
    admin
      .from('analytics_events')
      .select('event_type, session_id')
      .gte('created_at', since.toISOString())
      .lte('created_at', untilIso),
  ]);

  return [...(systemRes.data ?? []), ...(analyticsRes.data ?? [])];
}

export function funnelStagesToRecord(dropoffs: FunnelDropoff[]): Record<string, number> {
  return Object.fromEntries(dropoffs.map((d) => [d.stage, d.count]));
}
