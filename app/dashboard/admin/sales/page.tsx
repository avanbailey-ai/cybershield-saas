import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isOwner } from '@/lib/auth/owner';
import SalesDashboardClient from '@/components/enterprise/SalesDashboardClient';

export const metadata: Metadata = {
  title: 'Sales — Admin',
};

export default async function AdminSalesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isOwner(user.email)) {
    redirect('/dashboard');
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const [leadsRes, pipelineRes, demosRes] = await Promise.all([
    admin.from('enterprise_leads').select('*').order('created_at', { ascending: false }),
    admin.from('enterprise_pipeline').select('value_estimate, stage'),
    admin
      .from('enterprise_demos')
      .select('id, email, name, scheduled_time')
      .eq('status', 'scheduled')
      .gte('scheduled_time', now)
      .order('scheduled_time')
      .limit(10),
  ]);

  const leads = leadsRes.data ?? [];
  const qualifiedCount = leads.filter((l) => l.status === 'qualified').length;
  const totalLeads = leads.length;
  const conversionRate = totalLeads > 0 ? Math.round((qualifiedCount / totalLeads) * 100) : 0;

  const pipelineValue = (pipelineRes.data ?? []).reduce(
    (sum, row) => sum + Number(row.value_estimate ?? 0),
    0,
  );

  const domainCounts = leads.reduce<Record<string, number>>((acc, lead) => {
    if (lead.domain) {
      acc[lead.domain] = (acc[lead.domain] ?? 0) + 1;
    }
    return acc;
  }, {});

  const topDomains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, count]) => ({ domain, count }));

  return (
    <SalesDashboardClient
      email={user.email ?? 'Owner'}
      stats={{
        totalLeads,
        qualifiedCount,
        conversionRate,
        pipelineValue,
        upcomingDemos: demosRes.data ?? [],
        topDomains,
        recentLeads: leads.slice(0, 20),
      }}
    />
  );
}
