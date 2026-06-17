import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isOwner } from '@/lib/auth/owner';
import SalesDashboardClient from '@/components/enterprise/SalesDashboardClient';
import { computeSalesMetrics, type EnterpriseLeadRow } from '@/lib/sales/leadMetrics';

export const metadata: Metadata = {
  title: 'Sales — Admin',
};

export const dynamic = 'force-dynamic';

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
    admin.from('enterprise_pipeline').select('lead_id, value_estimate, stage'),
    admin
      .from('enterprise_demos')
      .select('id, email, name, scheduled_time')
      .eq('status', 'scheduled')
      .gte('scheduled_time', now)
      .order('scheduled_time')
      .limit(10),
  ]);

  const leads = (leadsRes.data ?? []) as EnterpriseLeadRow[];
  const metrics = computeSalesMetrics(leads, pipelineRes.data ?? [], false);

  return (
    <SalesDashboardClient
      email={user.email ?? 'Owner'}
      stats={{
        totalLeads: metrics.totalLeads,
        qualifiedCount: metrics.qualifiedCount,
        conversionRate: metrics.conversionRate,
        pipelineValue: metrics.pipelineValue,
        upcomingDemos: demosRes.data ?? [],
        topDomains: metrics.topDomains,
        recentLeads: metrics.recentLeads,
        excludedLeadCount: metrics.excludedLeadCount,
        allLeads: leads,
      }}
    />
  );
}
