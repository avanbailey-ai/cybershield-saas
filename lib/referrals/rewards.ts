import { createAdminClient } from '@/lib/supabase/admin';
import { computeViralScore } from '@/lib/referrals/viralScore';
import { isValidReferralCode } from '@/lib/referrals/codeFormat';

const BONUS_SCANS_REWARD = 5;
const PRO_UNLOCK_DAYS = 7;
const VIRAL_SCORE_CONVERSION_BONUS = 10;

export async function applyReferralConversionReward(referredUserId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: referredProfile } = await supabase
    .from('profiles')
    .select('referred_by_code, email, referral_code')
    .eq('id', referredUserId)
    .single();

  const referredByCode = referredProfile?.referred_by_code;
  if (!referredByCode || !isValidReferralCode(referredByCode)) return;

  const { data: referrerProfile } = await supabase
    .from('profiles')
    .select('id, email, viral_score, bonus_scans, pro_unlock_until')
    .eq('referral_code', referredByCode)
    .single();

  if (!referrerProfile) return;

  // Fraud: self-referral
  if (referrerProfile.id === referredUserId) return;

  // Fraud: same email
  if (
    referredProfile?.email &&
    referrerProfile.email &&
    referredProfile.email.toLowerCase() === referrerProfile.email.toLowerCase()
  ) {
    return;
  }

  const now = new Date();
  const proUnlockUntil = new Date(now);
  proUnlockUntil.setDate(proUnlockUntil.getDate() + PRO_UNLOCK_DAYS);

  const existingUnlock = referrerProfile.pro_unlock_until
    ? new Date(referrerProfile.pro_unlock_until)
    : null;
  const newUnlock =
    existingUnlock && existingUnlock > now ? existingUnlock : proUnlockUntil;

  const newBonusScans = (referrerProfile.bonus_scans ?? 0) + BONUS_SCANS_REWARD;
  const newViralScore = (referrerProfile.viral_score ?? 0) + VIRAL_SCORE_CONVERSION_BONUS;

  await supabase
    .from('profiles')
    .update({
      bonus_scans: newBonusScans,
      pro_unlock_until: newUnlock.toISOString(),
      viral_score: newViralScore,
    })
    .eq('id', referrerProfile.id);

  await supabase
    .from('referrals')
    .update({
      status: 'converted',
      converted_at: now.toISOString(),
    })
    .eq('referral_code', referredByCode)
    .eq('referred_user_id', referredUserId);

  await supabase.from('viral_events').insert({
    user_id: referrerProfile.id,
    event_type: 'referral_converted',
    metadata: {
      referredUserId,
      referralCode: referredByCode,
      bonusScans: BONUS_SCANS_REWARD,
    },
  });
}

export async function refreshViralScore(userId: string): Promise<number> {
  const supabase = createAdminClient();

  const [{ count: shares }, { count: signups }, { count: conversions }] = await Promise.all([
    supabase
      .from('viral_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_type', 'scan_shared'),
    supabase
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_user_id', userId)
      .in('status', ['signed_up', 'converted']),
    supabase
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_user_id', userId)
      .eq('status', 'converted'),
  ]);

  const score = computeViralScore({
    shares: shares ?? 0,
    referrals: signups ?? 0,
    conversions: conversions ?? 0,
  });

  await supabase.from('profiles').update({ viral_score: score }).eq('id', userId);
  return score;
}
