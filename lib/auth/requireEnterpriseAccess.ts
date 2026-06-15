import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { canAccessEnterprise } from '@/lib/auth/permissions';
import type { OrgRole } from '@/lib/auth/rbac';
import { ORG_CONTEXT_COOKIE, resolveOrgSessionContextFromSession } from '@/lib/org/sessionContext';
import type { SessionSubscriptionClient } from '@/lib/billing/getSubscriptionAccess';
import type { SubscriptionAccess } from '@/lib/billing/getSubscriptionAccess';

type EnterpriseAccessResult =
  | {
      allowed: true;
      orgId: string;
      role: OrgRole;
      access: SubscriptionAccess;
    }
  | {
      allowed: false;
      response: NextResponse;
    };

export async function requireEnterpriseAccess(
  user: User,
  supabase: SessionSubscriptionClient,
): Promise<EnterpriseAccessResult> {
  const cookieStore = await cookies();
  const cookieOrgId = cookieStore.get(ORG_CONTEXT_COOKIE)?.value ?? null;

  const orgCtx = await resolveOrgSessionContextFromSession(
    supabase,
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
    return {
      allowed: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  if (!orgCtx.orgId || !orgCtx.role) {
    return {
      allowed: false,
      response: NextResponse.json({ error: 'Organization context required' }, { status: 400 }),
    };
  }

  return {
    allowed: true,
    orgId: orgCtx.orgId,
    role: orgCtx.role,
    access: orgCtx.access,
  };
}
