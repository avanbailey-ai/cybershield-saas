import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import EnterprisePortalSidebar from '@/components/enterprise/EnterprisePortalSidebar';
import { canAccessEnterprise } from '@/lib/auth/permissions';
import { resolveOrgSessionContextFromSession } from '@/lib/org/sessionContext';
import type { SessionSubscriptionClient } from '@/lib/billing/getSubscriptionAccess';

export default async function EnterprisePortalLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/enterprise/login?redirectTo=/enterprise/portal');
  }

  const orgCtx = await resolveOrgSessionContextFromSession(
    supabase as unknown as SessionSubscriptionClient,
    user.id,
    user.email,
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
    redirect('/app');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0f1e]">
      <EnterprisePortalSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
