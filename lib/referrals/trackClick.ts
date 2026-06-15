import { createAdminClient } from '@/lib/supabase/admin';

import { isValidReferralCode } from '@/lib/referrals/codeFormat';



export async function trackReferralClick(params: {

  referralCode: string;

  referrerIp?: string | null;

}): Promise<{ tracked: boolean; reason?: string }> {

  const { referralCode, referrerIp } = params;



  if (!isValidReferralCode(referralCode)) {

    return { tracked: false, reason: 'invalid_code' };

  }



  const supabase = createAdminClient();



  const { data: referrerProfile } = await supabase

    .from('profiles')

    .select('id')

    .eq('referral_code', referralCode)

    .single();



  if (!referrerProfile) {

    return { tracked: false, reason: 'referrer_not_found' };

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



  // Idempotent click tracking — one viral event per IP + code per UTC day

  const today = new Date().toISOString().split('T')[0];

  const { data: priorClick } = await supabase

    .from('viral_events')

    .select('id')

    .eq('user_id', referrerProfile.id)

    .eq('event_type', 'referral_clicked')

    .gte('created_at', `${today}T00:00:00.000Z`)

    .contains('metadata', { referralCode, referrerIp: referrerIp ?? 'unknown' })

    .limit(1);



  if (!priorClick || priorClick.length === 0) {

    await supabase.from('viral_events').insert({

      user_id: referrerProfile.id,

      event_type: 'referral_clicked',

      metadata: { referralCode, referrerIp: referrerIp ?? 'unknown' },

    });

  }



  return { tracked: true };

}

