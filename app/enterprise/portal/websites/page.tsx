import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canAccessAgencyDashboard } from '@/lib/agency/planGate';
import { ORG_CONTEXT_COOKIE, resolveOrgSessionContextFromSession } from '@/lib/org/sessionContext';
import type { SessionSubscriptionClient } from '@/lib/billing/getSubscriptionAccess';
import { getActiveOrgId } from '@/lib/org/context';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import { AgencyClientWebsitesTable } from '@/components/agency/AgencyClientWebsitesView';
import { fetchAgencyClientWebsiteRows } from '@/lib/agency/fetchAgencyData';
import WebsiteList from '@/components/dashboard/websites/WebsiteList';
import { userFromSubscriptionAccess } from '@/lib/auth/enterpriseGateUser';

export const metadata: Metadata = {
  title: 'Client Websites — CyberShield Agency',
};

export default async function AgencyClientWebsitesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const cookieStore = await cookies();
  const cookieOrgId = cookieStore.get(ORG_CONTEXT_COOKIE)?.value ?? null;
  const orgCtx = await resolveOrgSessionContextFromSession(
    supabase as unknown as SessionSubscriptionClient,
    user.id,
    user.email,
    cookieOrgId,
  );

  const gateUser = userFromSubscriptionAccess(orgCtx.access, user.email);
  const isAgency = canAccessAgencyDashboard(gateUser, orgCtx.role);

  if (!isAgency) {
    return (
      <div className="flex flex-1 flex-col overflow-auto">
        <DashboardHeader email={user.email ?? 'User'} title="Websites" />
        <main className="flex-1 overflow-auto p-6">
          <WebsiteList />
        </main>
      </div>
    );
  }

  const orgId = orgCtx.orgId ?? (await getActiveOrgId(user.id));
  if (!orgId) redirect('/onboarding?reason=no_org');

  const admin = createAdminClient();
  const rows = await fetchAgencyClientWebsiteRows(admin, orgId);

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <DashboardHeader email={user.email ?? 'User'} title="Client Websites" />
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">Client Websites</h2>
          <p className="mt-1 text-sm text-gray-500">
            Portfolio view with client context, risk levels, and export-ready report status.
          </p>
        </div>
        <AgencyClientWebsitesTable rows={rows} />
        <div className="mt-10 border-t border-gray-800 pt-8">
          <h3 className="text-sm font-semibold text-white">Manage websites</h3>
          <p className="mt-1 text-xs text-gray-500">Add sites, run scans, and configure priority monitoring.</p>
          <div className="mt-4">
            <WebsiteList />
          </div>
        </div>
      </main>
    </div>
  );
}
