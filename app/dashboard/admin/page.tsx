import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isOwner } from '@/lib/auth/owner';
import DashboardHeader from '@/components/dashboard/DashboardHeader';

export const metadata: Metadata = {
  title: 'Admin — CyberShield',
};

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isOwner(user.email)) {
    redirect('/dashboard');
  }

  const admin = createAdminClient();

  const [profilesRes, websitesRes, scansRes, alertsRes] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }),
    admin.from('websites').select('id', { count: 'exact', head: true }),
    admin.from('scans').select('id', { count: 'exact', head: true }),
    admin.from('alerts').select('id', { count: 'exact', head: true }),
  ]);

  const stats = [
    { label: 'Total Users', value: profilesRes.count ?? 0 },
    { label: 'Websites Monitored', value: websitesRes.count ?? 0 },
    { label: 'Scans Run', value: scansRes.count ?? 0 },
    { label: 'Alerts', value: alertsRes.count ?? 0 },
  ];

  const { data: planBreakdown } = await admin.from('profiles').select('plan');

  const planCounts = (planBreakdown ?? []).reduce<Record<string, number>>((acc, row) => {
    const plan = row.plan ?? 'free';
    acc[plan] = (acc[plan] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <DashboardHeader email={user.email ?? 'Owner'} title="Admin" />

      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">Platform Overview</h2>
          <p className="mt-1 text-sm text-gray-500">
            Owner access — full override active for {user.email}
          </p>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-gray-800 bg-gray-900/50 p-5"
            >
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                {stat.label}
              </p>
              <p className="mt-2 text-3xl font-bold text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Users by Plan</h3>
            <div className="flex flex-wrap gap-4">
              <a
                href="/dashboard/admin/owner"
                className="text-xs font-medium text-violet-400 hover:text-violet-300"
              >
                Founder OS →
              </a>
              <a
                href="/dashboard/admin/owner#ceo-advisory"
                className="text-xs font-medium text-emerald-400 hover:text-emerald-300"
              >
                CEO Advisory (Founder OS) →
              </a>
              <a
                href="/dashboard/admin/revenue-intelligence"
                className="text-xs font-medium text-purple-400 hover:text-purple-300"
              >
                Revenue Intelligence →
              </a>
              <a
                href="/dashboard/admin/sales"
                className="text-xs font-medium text-blue-400 hover:text-blue-300"
              >
                Sales CRM →
              </a>
              <a
                href="/dashboard/admin/beta-reports"
                className="text-xs font-medium text-amber-400 hover:text-amber-300"
              >
                Beta Reports →
              </a>
              <a
                href="/dashboard/admin/monitoring"
                className="text-xs font-medium text-cyan-400 hover:text-cyan-300"
              >
                Monitoring Logs →
              </a>
              <a
                href="/dashboard/admin/analytics"
                className="text-xs font-medium text-blue-400 hover:text-blue-300"
              >
                Analytics →
              </a>
            </div>
          </div>
          <ul className="space-y-2">
            {Object.entries(planCounts).map(([plan, count]) => (
              <li
                key={plan}
                className="flex items-center justify-between rounded-lg bg-gray-800/40 px-4 py-3 text-sm"
              >
                <span className="capitalize text-gray-300">{plan}</span>
                <span className="font-semibold text-white">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
