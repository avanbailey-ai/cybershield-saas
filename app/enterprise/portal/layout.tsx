import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import EnterprisePortalSidebar from '@/components/enterprise/EnterprisePortalSidebar';
import { canAccessEnterprise } from '@/lib/auth/permissions';
import { getSubscriptionAccessFromSession, type SessionSubscriptionClient } from '@/lib/billing/getSubscriptionAccess';

export default async function EnterprisePortalLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirectTo=/enterprise/portal');
  }

  const access = await getSubscriptionAccessFromSession(
    supabase as unknown as SessionSubscriptionClient,
    user.id,
    user.email,
  );

  if (!canAccessEnterprise({ email: user.email, plan: access.plan, subscription_status: access.status })) {
    redirect('/app');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0f1e]">
      <EnterprisePortalSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
