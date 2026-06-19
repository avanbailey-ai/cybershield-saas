/**
 * sessionContext.ts — Resolve active org + subscription for middleware and API routes.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { getActiveOrgId } from '@/lib/org/context';
import { getUserOrgRole, type OrgRole } from '@/lib/auth/rbac';
import {
  getOrgSubscription,
  isSubscriptionActive,
  type OrgSubscription,
} from '@/lib/billing/orgSubscriptionService';
import { resolveSubscriptionAccess, type SubscriptionAccess } from '@/lib/billing/getSubscriptionAccess';
import type { Plan } from '@/lib/billing/plans';
import { applyQaSubscriptionAccess, fetchQaAccountFlags, type QaProfileReader } from '@/lib/billing/qaAccessService';

export const ORG_CONTEXT_COOKIE = 'cybershield_org_id';

export interface OrgSessionContext {
  orgId: string | null;
  role: OrgRole | null;
  subscription: OrgSubscription | null;
  access: SubscriptionAccess;
}

export async function resolveOrgSessionContext(
  userId: string,
  email?: string | null,
  preferredOrgId?: string | null,
): Promise<OrgSessionContext> {
  const orgId = preferredOrgId ?? (await getActiveOrgId(userId));
  if (!orgId) {
    return {
      orgId: null,
      role: null,
      subscription: null,
      access: resolveSubscriptionAccess(email, null),
    };
  }

  const [role, subscription] = await Promise.all([
    getUserOrgRole(userId, orgId),
    getOrgSubscription(orgId),
  ]);

  if (!role) {
    return {
      orgId: null,
      role: null,
      subscription: null,
      access: resolveSubscriptionAccess(email, null),
    };
  }

  const access = resolveSubscriptionAccess(email, {
    plan: subscription.plan,
    status: subscription.status,
  });

  const qaFlags = await fetchQaAccountFlags(userId);
  return { orgId, role, subscription, access: applyQaSubscriptionAccess(access, qaFlags) };
}

/** Session-scoped read for middleware (anon client + RLS). */
export type SessionOrgClient = {
  from: (relation: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => PromiseLike<{ data: Record<string, unknown> | null }>;
      };
    };
  };
};

export async function getOrgSubscriptionFromSession(
  supabase: SessionOrgClient,
  orgId: string,
): Promise<{ plan: Plan; status: string } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('organization_subscriptions')
    .select('plan, status')
    .eq('org_id', orgId)
    .maybeSingle();

  if (!data) return null;
  return { plan: data.plan as Plan, status: data.status ?? 'inactive' };
}

export async function resolveOrgSessionContextFromSession(
  supabase: SessionOrgClient,
  userId: string,
  email?: string | null,
  cookieOrgId?: string | null,
): Promise<OrgSessionContext> {
  let orgId = cookieOrgId ?? null;
  if (!orgId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('default_org_id')
      .eq('id', userId)
      .maybeSingle();
    orgId = (profile?.default_org_id as string | null | undefined) ?? null;
  }

  if (!orgId) {
    const admin = createAdminClient();
    const { data: membership } = await admin
      .from('organization_members')
      .select('org_id, role')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!membership) {
      const qaFlags = await fetchQaAccountFlags(userId, supabase as unknown as QaProfileReader);
      return {
        orgId: null,
        role: null,
        subscription: null,
        access: applyQaSubscriptionAccess(resolveSubscriptionAccess(email, null), qaFlags),
      };
    }

    const sub = await getOrgSubscription(membership.org_id);
    const qaFlags = await fetchQaAccountFlags(userId, supabase as unknown as QaProfileReader);
    return {
      orgId: membership.org_id,
      role: membership.role as OrgRole,
      subscription: sub,
      access: applyQaSubscriptionAccess(
        resolveSubscriptionAccess(email, { plan: sub.plan, status: sub.status }),
        qaFlags,
      ),
    };
  }

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from('organization_members')
    .select('role')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .maybeSingle();

  if (!membership) {
    return resolveOrgSessionContext(userId, email);
  }

  const sub = await getOrgSubscription(orgId);
  const qaFlags = await fetchQaAccountFlags(userId, supabase as unknown as QaProfileReader);
  return {
    orgId,
    role: membership.role as OrgRole,
    subscription: sub,
    access: applyQaSubscriptionAccess(
      resolveSubscriptionAccess(email, { plan: sub.plan, status: sub.status }),
      qaFlags,
    ),
  };
}

export function hasOrgMembership(ctx: OrgSessionContext): boolean {
  return ctx.orgId !== null && ctx.role !== null;
}

export function hasActiveOrgSubscription(ctx: OrgSessionContext): boolean {
  if (!ctx.subscription) return false;
  return isSubscriptionActive(ctx.subscription.status);
}
