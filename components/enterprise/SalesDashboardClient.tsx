'use client';

interface SalesStats {
  totalLeads: number;
  qualifiedCount: number;
  conversionRate: number;
  pipelineValue: number;
  upcomingDemos: Array<{
    id: string;
    email: string;
    name: string | null;
    scheduled_time: string;
  }>;
  topDomains: Array<{ domain: string; count: number }>;
  recentLeads: Array<{
    id: string;
    name: string;
    email: string;
    company: string | null;
    domain: string | null;
    lead_score: number;
    status: string;
    created_at: string;
  }>;
}

interface SalesDashboardClientProps {
  email: string;
  stats: SalesStats;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export default function SalesDashboardClient({ email, stats }: SalesDashboardClientProps) {
  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="border-b border-gray-800 bg-gray-900/50 px-6 py-4">
        <h1 className="text-xl font-bold text-white">Sales Dashboard</h1>
        <p className="text-sm text-gray-500">Owner CRM — {email}</p>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Leads" value={stats.totalLeads} />
          <StatCard label="Qualified" value={stats.qualifiedCount} />
          <StatCard label="Conversion Rate" value={`${stats.conversionRate}%`} />
          <StatCard label="Pipeline Value" value={formatCurrency(stats.pipelineValue)} />
        </div>

        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h2 className="mb-4 text-sm font-semibold text-white">Upcoming Demos</h2>
            {stats.upcomingDemos.length === 0 ? (
              <p className="text-sm text-gray-500">No demos scheduled.</p>
            ) : (
              <ul className="space-y-3">
                {stats.upcomingDemos.map((demo) => (
                  <li key={demo.id} className="rounded-lg bg-gray-800/40 px-4 py-3 text-sm">
                    <p className="font-medium text-white">{demo.name ?? demo.email}</p>
                    <p className="text-gray-400">
                      {new Date(demo.scheduled_time).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h2 className="mb-4 text-sm font-semibold text-white">Top Domains</h2>
            {stats.topDomains.length === 0 ? (
              <p className="text-sm text-gray-500">No domain data yet.</p>
            ) : (
              <ul className="space-y-2">
                {stats.topDomains.map(({ domain, count }) => (
                  <li key={domain} className="flex justify-between rounded-lg bg-gray-800/40 px-4 py-2 text-sm">
                    <span className="text-gray-300">{domain}</span>
                    <span className="font-semibold text-white">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <h2 className="mb-4 text-sm font-semibold text-white">Recent Leads</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-xs uppercase text-gray-500">
                  <th className="pb-3 pr-4">Name</th>
                  <th className="pb-3 pr-4">Company</th>
                  <th className="pb-3 pr-4">Domain</th>
                  <th className="pb-3 pr-4">Score</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentLeads.map((lead) => (
                  <tr key={lead.id} className="border-b border-gray-800/50">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-white">{lead.name}</p>
                      <p className="text-xs text-gray-500">{lead.email}</p>
                    </td>
                    <td className="py-3 pr-4 text-gray-300">{lead.company ?? '—'}</td>
                    <td className="py-3 pr-4 text-gray-300">{lead.domain ?? '—'}</td>
                    <td className="py-3 pr-4">
                      <span className={`font-semibold ${lead.lead_score >= 70 ? 'text-green-400' : lead.lead_score >= 50 ? 'text-yellow-400' : 'text-gray-400'}`}>
                        {lead.lead_score}
                      </span>
                    </td>
                    <td className="py-3 pr-4 capitalize text-gray-300">{lead.status}</td>
                    <td className="py-3 text-gray-500">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
    </div>
  );
}
