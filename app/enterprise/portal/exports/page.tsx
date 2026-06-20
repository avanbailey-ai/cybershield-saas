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
import EnterpriseExportPdfButton from '@/components/enterprise/EnterpriseExportPdfButton';
import AgencyProofOfWorkCard from '@/components/agency/AgencyProofOfWorkCard';
import { fetchEnterpriseCommandCenterData } from '@/lib/enterprise/fetchEnterpriseCommandCenterData';
import { userFromSubscriptionAccess } from '@/lib/auth/enterpriseGateUser';
import { getOrganization } from '@/lib/org/context';
import { getUserOrgRole } from '@/lib/auth/rbac';
import { PLAN_LIMITS } from '@/lib/billing/plans';
import { normalizePlan } from '@/lib/auth/permissions';

export const metadata: Metadata = {
  title: 'Exports — CyberShield Agency',
};

export default async function AgencyExportsPage() {
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

  if (!canAccessAgencyDashboard(userFromSubscriptionAccess(orgCtx.access, user.email), orgCtx.role)) {
    redirect('/app/settings?upgrade=agency');
  }

  const orgId = orgCtx.orgId ?? (await getActiveOrgId(user.id));
  if (!orgId) redirect('/onboarding?reason=no_org');

  const org = await getOrganization(orgId);
  const admin = createAdminClient();
  const orgRole = orgCtx.role ?? (await getUserOrgRole(user.id, orgId));
  const isAdmin = orgRole === 'owner' || orgRole === 'admin';
  const planLabel = PLAN_LIMITS[normalizePlan(orgCtx.access.plan)]?.name ?? 'Agency';

  const data = await fetchEnterpriseCommandCenterData({
    admin,
    orgId,
    userEmail: user.email,
    orgName: org?.name ?? null,
    planLabel,
    isAdmin,
    prioritySlotsUsed: null,
    prioritySlotsLimit: null,
  });

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <DashboardHeader email={user.email ?? 'User'} title="Exports" />
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6 space-y-2">
          <h2 className="text-xl font-bold text-white">Export for Clients</h2>
          <p className="text-sm text-gray-500">
            Copy or download client-ready reports and proof-of-work. CyberShield never sends emails automatically.
          </p>
        </div>

        <div className="space-y-6">
          <AgencyProofOfWorkCard
            metrics={data.valueMetrics}
            reportsGenerated={data.protectedWebsites.filter((w) => w.scanId).length}
            orgId={orgId}
          />

          {isAdmin && (
            <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
              <h3 className="text-sm font-semibold text-white">Organization PDF export</h3>
              <p className="mt-1 text-sm text-gray-400">
                Download a portfolio-level executive summary for internal use or client QBRs.
              </p>
              <div className="mt-4">
                <EnterpriseExportPdfButton orgId={orgId} />
              </div>
            </section>
          )}

          <section className="rounded-xl border border-dashed border-gray-700 p-5 text-sm text-gray-500">
            Per-client exports are available from Client Reports and each website&apos;s report page.
            Use &quot;Export for website owner&quot; or &quot;Copy client email&quot; — copy only, no auto-send.
          </section>
        </div>
      </main>
    </div>
  );
}
