import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/owner';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import ProblemReportsAdmin from '@/components/beta/ProblemReportsAdmin';

export const dynamic = 'force-dynamic';

export default async function ProblemReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/enterprise/login?redirectTo=/enterprise/portal/problem-reports');
  if (!isOwner(user.email)) redirect('/enterprise/portal');

  return (
    <>
      <DashboardHeader title="Beta Problem Reports" email={user.email ?? ''} />
      <main className="flex-1 overflow-y-auto p-6">
        <p className="mb-6 text-sm text-gray-400">
          Internal view of beta feedback submitted via Report a Problem. Owner access only.
        </p>
        <ProblemReportsAdmin />
      </main>
    </>
  );
}
