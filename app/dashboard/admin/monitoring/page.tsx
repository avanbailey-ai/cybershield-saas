import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/owner';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import MonitoringLogsClient from '@/components/admin/MonitoringLogsClient';

export const metadata: Metadata = {
  title: 'Monitoring Logs — CyberShield Admin',
};

export default async function MonitoringLogsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isOwner(user.email)) {
    redirect('/dashboard');
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <DashboardHeader email={user.email ?? 'Owner'} title="Monitoring Logs" />

      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">Cron &amp; Email Monitoring</h2>
          <p className="mt-1 text-sm text-gray-500">
            Recent scheduled scan runs and grouped alert emails — use this to verify email volume.
          </p>
        </div>

        <MonitoringLogsClient />
      </main>
    </div>
  );
}
