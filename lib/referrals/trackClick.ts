import { createAdminClient } from '@/lib/supabase/admin';
import { isValidReferralCode } from '@/lib/referrals/code';

export async function trackReferralClick(params: {
  referralCode: string;
  referrerIp?: string | null;
}): Promise<{ tracked: boolean }> {
  const { referralCode, referrerIp } = params;

  if (!isValidReferralCode(referralCode)) {
    return { tracked: false };
  }

  const supabase = createAdminClient();

  const { data: referrerProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('referral_code', referralCode)
    .single();

  if (!referrerProfile) {
    return { tracked: false };
  }

  const { data: existing } = await supabase
    .from('referrals')
    .select('id')
    .eq('referral_code', referralCode)
    .is('referred_user_id', null)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('referrals')
      .update({ referrer_ip: referrerIp ?? null, created_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase.from('referrals').insert({
      referrer_user_id: referrerProfile.id,
      referral_code: referralCode,
      status: 'clicked',
      referrer_ip: referrerIp ?? null,
    });
  }

  await supabase.from('viral_events').insert({
    user_id: referrerProfile.id,
    event_type: 'referral_clicked',
    metadata: { referralCode },
  });

  return { tracked: true };
}
