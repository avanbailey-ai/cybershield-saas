import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/owner';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import ProblemReportsAdmin from '@/components/beta/ProblemReportsAdmin';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Beta Reports — CyberShield Admin',
};

export default async function BetaReportsAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?redirectTo=/dashboard/admin/beta-reports');
  if (!isOwner(user.email)) redirect('/dashboard');

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <DashboardHeader title="Beta Reports" email={user.email ?? ''} />
      <main className="flex-1 overflow-y-auto p-6">
        <p className="mb-6 text-sm text-gray-400">
          Internal view of beta feedback submitted via Report a Problem. Owner access only.
        </p>
        <ProblemReportsAdmin />
      </main>
    </div>
  );
}
