import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getActiveOrgId } from '@/lib/org/context';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import ScansActivityDashboard from '@/components/dashboard/ScansActivityDashboard';
import { fetchCommandCenterData } from '@/lib/dashboard/fetchCommandCenterData';

export const metadata: Metadata = {
  title: 'Monitoring Activity — CyberShield',
};

export default async function ScansPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const orgId = await getActiveOrgId(user.id);
  const data = await fetchCommandCenterData(supabase, user.id, user.email, orgId);

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <DashboardHeader email={user.email ?? 'User'} title="Monitoring Activity" />
      <main className="flex-1 overflow-auto p-4 sm:p-6">
        <ScansActivityDashboard data={data} />
      </main>
    </div>
  );
}
