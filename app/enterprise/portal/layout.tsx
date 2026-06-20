import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import EnterprisePortalShell from '@/components/enterprise/EnterprisePortalShell';
import { canAccessEnterprise } from '@/lib/auth/permissions';
import { ORG_CONTEXT_COOKIE, resolveOrgSessionContextFromSession } from '@/lib/org/sessionContext';
import type { SessionSubscriptionClient } from '@/lib/billing/getSubscriptionAccess';
import { isOwner } from '@/lib/auth/owner';
import { OWNER_HOME_PATH } from '@/lib/auth/ownerExperience';
import ReportProblemWidget from '@/components/beta/ReportProblemWidget';
import { NO_INDEX_ROBOTS } from '@/lib/seo/noIndexMetadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: NO_INDEX_ROBOTS,
};

export default async function EnterprisePortalLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/enterprise/login?redirectTo=/enterprise/portal');
  }

  if (isOwner(user.email)) {
    redirect(OWNER_HOME_PATH);
  }

  const cookieStore = await cookies();
  const cookieOrgId = cookieStore.get(ORG_CONTEXT_COOKIE)?.value ?? null;

  const orgCtx = await resolveOrgSessionContextFromSession(
    supabase as unknown as SessionSubscriptionClient,
    user.id,
    user.email,
    cookieOrgId,
  );

  if (
    !canAccessEnterprise(
      {
        email: user.email,
        plan: orgCtx.access.plan,
        subscription_status: orgCtx.access.status,
      },
      orgCtx.role,
    )
  ) {
    redirect('/enterprise/review?access=required');
  }

  return (
    <>
      <EnterprisePortalShell showOwnerTools={false}>{children}</EnterprisePortalShell>
      <ReportProblemWidget userEmail={user.email} />
    </>
  );
}
