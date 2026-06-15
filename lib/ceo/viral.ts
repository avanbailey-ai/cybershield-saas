/**
 * Viral loop monitoring — referrals, shares, conversions.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export interface ViralMetrics {
  referralClicks: number;
  referralSignups: number;
  referralConversions: number;
  scanShared: number;
  scanCompleted: number;
  shareRate: number;
  viralReferralRate: number;
}

export async function getViralMetrics(since: Date, until?: Date): Promise<ViralMetrics> {
  const admin = createAdminClient();
  const untilIso = until?.toISOString() ?? new Date().toISOString();
  const sinceIso = since.toISOString();

  const [viralRes, referralsRes, scanRes] = await Promise.all([
    admin
      .from('viral_events')
      .select('event_type')
      .gte('created_at', sinceIso)
      .lte('created_at', untilIso),
    admin
      .from('referrals')
      .select('status')
      .gte('created_at', sinceIso)
      .lte('created_at', untilIso),
    admin
      .from('analytics_events')
      .select('event_type')
      .in('event_type', ['scan_completed', 'scan_shared'])
      .gte('created_at', sinceIso)
      .lte('created_at', untilIso),
  ]);

  const viralEvents = viralRes.data ?? [];
  const referrals = referralsRes.data ?? [];
  const scanEvents = scanRes.data ?? [];

  const referralClicks =
    viralEvents.filter((e) => e.event_type === 'referral_clicked').length +
    referrals.filter((r) => r.status === 'clicked').length;
  const referralSignups =
    viralEvents.filter((e) => e.event_type === 'referral_signed_up').length +
    referrals.filter((r) => r.status === 'signed_up').length;
  const referralConversions =
    viralEvents.filter((e) => e.event_type === 'referral_converted').length +
    referrals.filter((r) => r.status === 'converted').length;

  const scanShared =
    viralEvents.filter((e) => e.event_type === 'scan_shared').length +
    scanEvents.filter((e) => e.event_type === 'scan_shared').length;
  const scanCompleted = scanEvents.filter((e) => e.event_type === 'scan_completed').length;

  const shareRate =
    scanCompleted > 0 ? Math.round((scanShared / scanCompleted) * 1000) / 10 : 0;
  const viralReferralRate =
    referralClicks > 0
      ? Math.round((referralConversions / referralClicks) * 1000) / 10
      : 0;

  return {
    referralClicks,
    referralSignups,
    referralConversions,
    scanShared,
    scanCompleted,
    shareRate,
    viralReferralRate,
  };
}
