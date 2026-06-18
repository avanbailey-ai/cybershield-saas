import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { getActiveOrgId } from '@/lib/org/context';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import CyberShieldValueSummary from '@/components/dashboard/CyberShieldValueSummary';
import RetentionBanner from '@/components/dashboard/RetentionBanner';
import WebsiteHealthCenter from '@/components/dashboard/websites/WebsiteHealthCenter';
import { getWebsiteDisplayName } from '@/lib/dashboard/dashboardCommandCenter';
import { fetchCommandCenterData } from '@/lib/dashboard/fetchCommandCenterData';
import { fetchWebsiteHealthCenter } from '@/lib/websiteHealth/fetchWebsiteHealthCenter';

export const metadata: Metadata = {
  title: 'Health Center — CyberShield',
};

export default async function WebsiteHealthPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const health = await fetchWebsiteHealthCenter(supabase, id);
  if (!health) notFound();

  const orgId = await getActiveOrgId(user.id);
  const commandCenter = await fetchCommandCenterData(supabase, user.id, user.email, orgId);

  const displayLabel = getWebsiteDisplayName(health.website.label, health.website.url);

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <DashboardHeader email={user.email ?? 'User'} title="Health Center" />
      <main className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="mb-6 space-y-6">
          {commandCenter.showRetentionBanner && <RetentionBanner variant="protection" />}
          <CyberShieldValueSummary metrics={commandCenter.valueSummary} compact />
        </div>
        <WebsiteHealthCenter data={health} displayLabel={displayLabel} />
      </main>
    </div>
  );
}
