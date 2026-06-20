import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import AlertsList, { type AlertRow } from '@/components/dashboard/alerts/AlertsList';
import { canAccessFeature } from '@/lib/auth/featureGate';
import { getSubscriptionAccessFromSession, type SessionSubscriptionClient } from '@/lib/billing/getSubscriptionAccess';
import { canAccessAgencyDashboard } from '@/lib/agency/planGate';
import { userFromSubscriptionAccess } from '@/lib/auth/enterpriseGateUser';
import { ORG_CONTEXT_COOKIE, resolveOrgSessionContextFromSession } from '@/lib/org/sessionContext';
import { getActiveOrgId } from '@/lib/org/context';
import { fetchAgencyAlertGroups } from '@/lib/agency/fetchAgencyData';
import { AgencyAlertsGroupedView } from '@/components/agency/AgencyDashboardPanels';

export const metadata: Metadata = {
  title: 'Alerts — CyberShield',
};

export default async function AlertsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const access = await getSubscriptionAccessFromSession(
    supabase as unknown as SessionSubscriptionClient,
    user.id,
    user.email,
  );

  if (!canAccessFeature({ email: user.email, plan: access.plan, subscription_status: access.status }, 'alerts')) {
    redirect('/app/settings?upgrade=alerts');
  }

  const cookieStore = await cookies();
  const cookieOrgId = cookieStore.get(ORG_CONTEXT_COOKIE)?.value ?? null;
  const orgCtx = await resolveOrgSessionContextFromSession(
    supabase as unknown as SessionSubscriptionClient,
    user.id,
    user.email,
    cookieOrgId,
  );
  const isAgency = canAccessAgencyDashboard(
    userFromSubscriptionAccess(orgCtx.access, user.email),
    orgCtx.role,
  );
  const orgId = orgCtx.orgId ?? (await getActiveOrgId(user.id));

  if (isAgency && orgId) {
    const admin = createAdminClient();
    const groups = await fetchAgencyAlertGroups(admin, orgId);

    return (
      <div className="flex flex-1 flex-col overflow-auto">
        <DashboardHeader email={user.email ?? 'User'} title="Alerts" />
        <main className="flex-1 overflow-auto p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">Alerts by Client</h2>
            <p className="mt-1 text-sm text-gray-500">
              Unread alerts grouped by client website. Copy client-safe notes — never sent automatically.
            </p>
          </div>
          <AgencyAlertsGroupedView groups={groups} />
        </main>
      </div>
    );
  }

  const { data: alerts } = await supabase
    .from('alerts')
    .select(`id, title, message, severity, type, is_read, created_at, website_id, scan_id, websites(url, label)`)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <DashboardHeader email={user.email ?? 'User'} title="Alerts" />
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">Protection Alerts</h2>
          <p className="mt-1 text-sm text-gray-500">
            Website health and monitoring notifications for your protected sites.
          </p>
        </div>
        <AlertsList initialAlerts={(alerts ?? []) as unknown as AlertRow[]} />
      </main>
    </div>
  );
}
