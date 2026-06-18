import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import { getOrCreateReferralCode, maskUserId } from '@/lib/referrals/code';
import ReferralsDashboardClient from '@/components/referrals/ReferralsDashboardClient';
import { resolveSiteUrl } from '@/lib/site/getSiteUrl';

export const metadata = {
  title: 'Referrals — CyberShield',
};

export default async function ReferralsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirectTo=/dashboard/referrals');
  }

  const referralCode = await getOrCreateReferralCode(user.id);

  const { data: profile } = await supabase
    .from('profiles')
    .select('viral_score, bonus_scans, pro_unlock_until')
    .eq('id', user.id)
    .single();

  const { data: referrals } = await supabase
    .from('referrals')
    .select('status, created_at')
    .eq('referrer_user_id', user.id);

  const stats = {
    clicks: referrals?.filter((r) => r.status === 'clicked').length ?? 0,
    signups: referrals?.filter((r) => r.status === 'signed_up').length ?? 0,
    conversions: referrals?.filter((r) => r.status === 'converted').length ?? 0,
  };

  const baseUrl = resolveSiteUrl();

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <DashboardHeader email={user.email ?? 'User'} title="Referrals" />
      <ReferralsDashboardClient
        referralCode={referralCode}
        referralLink={`${baseUrl}/signup?ref=${referralCode}`}
        maskedName={maskUserId(user.id)}
        viralScore={profile?.viral_score ?? 0}
        bonusScans={profile?.bonus_scans ?? 0}
        proUnlockUntil={profile?.pro_unlock_until ?? null}
        stats={stats}
      />
    </div>
  );
}
