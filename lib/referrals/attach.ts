import { createAdminClient } from '@/lib/supabase/admin';
import { isValidReferralCode } from '@/lib/referrals/code';

export async function attachReferralOnSignup(params: {
  userId: string;
  email: string;
  referralCode: string;
  referrerIp?: string | null;
}): Promise<{ attached: boolean; reason?: string }> {
  const { userId, email, referralCode, referrerIp } = params;

  if (!isValidReferralCode(referralCode)) {
    return { attached: false, reason: 'invalid_code' };
  }

  const supabase = createAdminClient();

  const { data: referrerProfile } = await supabase
    .from('profiles')
    .select('id, email, referral_code')
    .eq('referral_code', referralCode)
    .single();

  if (!referrerProfile) {
    return { attached: false, reason: 'referrer_not_found' };
  }

  // Fraud: self-referral
  if (referrerProfile.id === userId) {
    return { attached: false, reason: 'self_referral' };
  }

  // Fraud: same email as referrer
  if (
    referrerProfile.email &&
    email.toLowerCase() === referrerProfile.email.toLowerCase()
  ) {
    return { attached: false, reason: 'same_email' };
  }

  // Fraud: duplicate referred email
  const { data: existingByEmail } = await supabase
    .from('referrals')
    .select('id')
    .eq('referred_email', email.toLowerCase())
    .limit(1);

  if (existingByEmail && existingByEmail.length > 0) {
    return { attached: false, reason: 'duplicate_email' };
  }

  const { data: userProfile } = await supabase
    .from('profiles')
    .select('referred_by_code')
    .eq('id', userId)
    .single();

  if (userProfile?.referred_by_code) {
    return { attached: false, reason: 'already_attached' };
  }

  await supabase
    .from('profiles')
    .update({ referred_by_code: referralCode })
    .eq('id', userId);

  const { data: pendingReferral } = await supabase
    .from('referrals')
    .select('id')
    .eq('referral_code', referralCode)
    .is('referred_user_id', null)
    .maybeSingle();

  if (pendingReferral) {
    await supabase
      .from('referrals')
      .update({
        status: 'signed_up',
        referred_user_id: userId,
        referred_email: email.toLowerCase(),
      })
      .eq('id', pendingReferral.id);
  } else {
    await supabase.from('referrals').insert({
      referrer_user_id: referrerProfile.id,
      referred_user_id: userId,
      referral_code: referralCode,
      status: 'signed_up',
      referred_email: email.toLowerCase(),
      referrer_ip: referrerIp ?? null,
    });
  }

  await supabase.from('viral_events').insert({
    user_id: referrerProfile.id,
    event_type: 'referral_signed_up',
    metadata: { referralCode, referredEmail: email },
  });

  return { attached: true };
}
