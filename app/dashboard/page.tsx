import { getActiveOrgId } from '@/lib/org/context';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import CommandCenterDashboard from '@/components/dashboard/CommandCenterDashboard';
import { fetchCommandCenterData } from '@/lib/dashboard/fetchCommandCenterData';

export const metadata: Metadata = {
  title: 'Dashboard',
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const orgId = await getActiveOrgId(user.id);
  const commandCenterData = await fetchCommandCenterData(
    supabase,
    user.id,
    user.email,
    orgId,
  );

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <DashboardHeader email={user.email ?? 'User'} />

      <main className="flex-1 overflow-auto p-4 sm:p-6">
        <CommandCenterDashboard data={commandCenterData} />
      </main>
    </div>
  );
}
