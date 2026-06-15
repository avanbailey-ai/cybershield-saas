import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import AlertsList, { type AlertRow } from '@/components/dashboard/alerts/AlertsList';
import { canAccessFeature } from '@/lib/auth/featureGate';
import { isOwner } from '@/lib/auth/owner';

export const metadata: Metadata = {
  title: 'Alerts — CyberShield',
};

export default async function AlertsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, subscription_status')
    .eq('id', user.id)
    .single();

  const plan = isOwner(user.email) ? 'owner' : (profile?.plan ?? 'free');
  const subscriptionStatus = isOwner(user.email) ? 'active' : (profile?.subscription_status ?? 'inactive');

  if (!canAccessFeature({ email: user.email, plan, subscription_status: subscriptionStatus }, 'alerts')) {
    redirect('/dashboard/settings');
  }

  const { data: alerts } = await supabase
    .from('alerts')
    .select(`id, title, message, severity, is_read, created_at, website_id, scan_id, websites(url, label)`)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <DashboardHeader email={user.email ?? 'User'} />
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">Alerts</h2>
          <p className="mt-1 text-sm text-gray-500">
            Security notifications for your monitored websites.
          </p>
        </div>
        <AlertsList initialAlerts={(alerts ?? []) as unknown as AlertRow[]} />
      </main>
    </div>
  );
}
