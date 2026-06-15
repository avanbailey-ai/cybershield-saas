/**
 * orgSubscriptionService.ts — Org-level subscription state (Stripe webhook source of truth for gating).
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { normalizePlan } from '@/lib/auth/permissions';
import type { Plan } from './plans';
import { getSeatLimitForPlan } from './orgPlans';
import { isSubscriptionActive } from './subscriptionService';

export interface OrgSubscription {
  orgId: string;
  plan: Plan;
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  currentPeriodEnd: string | null;
}

const DEFAULT_ORG_SUB: Omit<OrgSubscription, 'orgId'> = {
  plan: 'free',
  status: 'inactive',
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  stripePriceId: null,
  currentPeriodEnd: null,
};

export async function getOrgSubscription(orgId: string): Promise<OrgSubscription> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('organization_subscriptions')
    .select(
      'org_id, plan, status, stripe_customer_id, stripe_subscription_id, stripe_price_id, current_period_end',
    )
    .eq('org_id', orgId)
    .maybeSingle();

  if (!data) {
    return { orgId, ...DEFAULT_ORG_SUB };
  }

  return {
    orgId: data.org_id,
    plan: normalizePlan(data.plan),
    status: data.status ?? 'inactive',
    stripeCustomerId: data.stripe_customer_id ?? null,
    stripeSubscriptionId: data.stripe_subscription_id ?? null,
    stripePriceId: data.stripe_price_id ?? null,
    currentPeriodEnd: data.current_period_end ?? null,
  };
}

export interface UpsertOrgSubscriptionParams {
  orgId: string;
  plan: Plan;
  status: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  currentPeriodEnd?: string | null;
}

/** Sync organization_subscriptions + organizations mirror (webhook only). */
export async function upsertOrgSubscription(params: UpsertOrgSubscriptionParams): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { error: subErr } = await supabase.from('organization_subscriptions').upsert(
    {
      org_id: params.orgId,
      plan: params.plan,
      status: params.status,
      stripe_customer_id: params.stripeCustomerId ?? null,
      stripe_subscription_id: params.stripeSubscriptionId ?? null,
      stripe_price_id: params.stripePriceId ?? null,
      current_period_end: params.currentPeriodEnd ?? null,
      updated_at: now,
    },
    { onConflict: 'org_id' },
  );
  if (subErr) throw subErr;

  const orgUpdate: Record<string, string | number | null> = {
    plan: params.plan,
    seat_limit: params.plan === 'free' ? 1 : getSeatLimitForPlan(params.plan),
  };
  if (params.stripeCustomerId !== undefined) orgUpdate.stripe_customer_id = params.stripeCustomerId;
  if (params.stripeSubscriptionId !== undefined) {
    orgUpdate.stripe_subscription_id = params.stripeSubscriptionId;
  }

  const { error: orgErr } = await supabase.from('organizations').update(orgUpdate).eq('id', params.orgId);
  if (orgErr) throw orgErr;
}

/** Update org subscription by Stripe customer id. */
export async function updateOrgSubscriptionByCustomerId(
  stripeCustomerId: string,
  update: {
    plan?: Plan;
    status: string;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    currentPeriodEnd?: string | null;
  },
): Promise<string[]> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: rows, error: fetchErr } = await supabase
    .from('organization_subscriptions')
    .select('org_id')
    .eq('stripe_customer_id', stripeCustomerId);

  if (fetchErr) throw fetchErr;

  const orgIds = (rows ?? []).map((r) => r.org_id as string);
  if (orgIds.length === 0) {
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id')
      .eq('stripe_customer_id', stripeCustomerId);
    for (const org of orgs ?? []) {
      orgIds.push(org.id);
    }
  }

  const subRow: Record<string, string | null> = {
    status: update.status,
    updated_at: now,
  };
  if (update.plan !== undefined) subRow.plan = update.plan;
  if (update.stripeSubscriptionId !== undefined) {
    subRow.stripe_subscription_id = update.stripeSubscriptionId;
  }
  if (update.stripePriceId !== undefined) subRow.stripe_price_id = update.stripePriceId;
  if (update.currentPeriodEnd !== undefined) subRow.current_period_end = update.currentPeriodEnd;

  for (const orgId of orgIds) {
    await supabase.from('organization_subscriptions').upsert(
      {
        org_id: orgId,
        stripe_customer_id: stripeCustomerId,
        plan: update.plan ?? 'free',
        ...subRow,
      },
      { onConflict: 'org_id' },
    );

    if (update.plan !== undefined) {
      await supabase
        .from('organizations')
        .update({
          plan: update.plan,
          seat_limit: update.plan === 'free' ? 1 : getSeatLimitForPlan(update.plan),
          ...(update.stripeSubscriptionId !== undefined
            ? { stripe_subscription_id: update.stripeSubscriptionId }
            : {}),
        })
        .eq('id', orgId);
    }
  }

  return orgIds;
}

export async function resolveOrgIdFromStripeCustomer(
  stripeCustomerId: string,
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('organization_subscriptions')
    .select('org_id')
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle();

  if (data?.org_id) return data.org_id;

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle();

  return org?.id ?? null;
}

export { isSubscriptionActive };
