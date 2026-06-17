import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import EnterprisePortalShell from '@/components/enterprise/EnterprisePortalShell';
import { canAccessEnterprise } from '@/lib/auth/permissions';
import { ORG_CONTEXT_COOKIE, resolveOrgSessionContextFromSession } from '@/lib/org/sessionContext';
import type { SessionSubscriptionClient } from '@/lib/billing/getSubscriptionAccess';
import { isOwner } from '@/lib/auth/owner';
import ReportProblemWidget from '@/components/beta/ReportProblemWidget';

export default async function EnterprisePortalLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/enterprise/login?redirectTo=/enterprise/portal');
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
    !isOwner(user.email) &&
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
      <EnterprisePortalShell showOwnerTools={isOwner(user.email)}>{children}</EnterprisePortalShell>
      <ReportProblemWidget userEmail={user.email} />
    </>
  );
}
