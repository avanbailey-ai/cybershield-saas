/**
 * subscriptionService.ts — Read subscription state (Stripe webhook is source of truth).
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { Plan } from './plans';
import { normalizePlan } from '@/lib/auth/permissions';

export interface UserSubscription {
  userId: string;
  plan: Plan;
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
}

const ACTIVE_STATUSES = new Set(['active', 'trialing']);

export function isSubscriptionActive(status: string | null | undefined): boolean {
  return ACTIVE_STATUSES.has(status ?? 'inactive');
}

export function isPaidPlan(plan: Plan): boolean {
  return plan === 'pro' || plan === 'growth' || plan === 'agency';
}

/** Load subscription row; fall back to profiles mirror if subscriptions row missing. */
export async function getUserSubscription(userId: string): Promise<UserSubscription> {
  const supabase = createAdminClient();

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('user_id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_end')
    .eq('user_id', userId)
    .maybeSingle();

  if (sub) {
    return {
      userId: sub.user_id,
      plan: normalizePlan(sub.plan),
      status: sub.status ?? 'inactive',
      stripeCustomerId: sub.stripe_customer_id ?? null,
      stripeSubscriptionId: sub.stripe_subscription_id ?? null,
      currentPeriodEnd: sub.current_period_end ?? null,
    };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, plan, subscription_status, stripe_customer_id, stripe_subscription_id')
    .eq('id', userId)
    .maybeSingle();

  return {
    userId,
    plan: normalizePlan(profile?.plan),
    status: profile?.subscription_status ?? 'inactive',
    stripeCustomerId: profile?.stripe_customer_id ?? null,
    stripeSubscriptionId: profile?.stripe_subscription_id ?? null,
    currentPeriodEnd: null,
  };
}

export interface UpsertSubscriptionParams {
  userId: string;
  plan: Plan;
  status: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: string | null;
}

/** Sync subscriptions table + profiles mirror (called from Stripe webhook only). */
export async function upsertUserSubscription(params: UpsertSubscriptionParams): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const profileUpdate: Record<string, string | null> = {
    plan: params.plan,
    subscription_status: params.status,
  };
  if (params.stripeCustomerId !== undefined) profileUpdate.stripe_customer_id = params.stripeCustomerId;
  if (params.stripeSubscriptionId !== undefined) profileUpdate.stripe_subscription_id = params.stripeSubscriptionId;

  const { error: profileErr } = await supabase.from('profiles').update(profileUpdate).eq('id', params.userId);
  if (profileErr) throw profileErr;

  const { error: subErr } = await supabase.from('subscriptions').upsert(
    {
      user_id: params.userId,
      plan: params.plan,
      status: params.status,
      stripe_customer_id: params.stripeCustomerId ?? null,
      stripe_subscription_id: params.stripeSubscriptionId ?? null,
      current_period_end: params.currentPeriodEnd ?? null,
      updated_at: now,
    },
    { onConflict: 'user_id' },
  );
  if (subErr) throw subErr;
}

/** Update subscription by Stripe customer id (subscription.updated/deleted events). */
export async function updateSubscriptionByCustomerId(
  stripeCustomerId: string,
  update: {
    plan?: Plan;
    status: string;
    stripeSubscriptionId?: string | null;
    currentPeriodEnd?: string | null;
  },
): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const profileUpdate: Record<string, string | null> = { subscription_status: update.status };
  if (update.plan) profileUpdate.plan = update.plan;
  if (update.stripeSubscriptionId !== undefined) profileUpdate.stripe_subscription_id = update.stripeSubscriptionId;

  const { data: profiles, error: profileErr } = await supabase
    .from('profiles')
    .update(profileUpdate)
    .eq('stripe_customer_id', stripeCustomerId)
    .select('id');

  if (profileErr) throw profileErr;

  const subRow: Record<string, string | null> = {
    status: update.status,
    updated_at: now,
  };
  if (update.plan) subRow.plan = update.plan;
  if (update.stripeSubscriptionId !== undefined) subRow.stripe_subscription_id = update.stripeSubscriptionId;
  if (update.currentPeriodEnd !== undefined) subRow.current_period_end = update.currentPeriodEnd;

  const { error: subErr } = await supabase
    .from('subscriptions')
    .update(subRow)
    .eq('stripe_customer_id', stripeCustomerId);

  if (subErr && subErr.code !== '42P01') throw subErr;

  for (const row of profiles ?? []) {
    if (update.plan) {
      await supabase.from('subscriptions').upsert(
        {
          user_id: row.id,
          plan: update.plan,
          status: update.status,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: update.stripeSubscriptionId ?? null,
          current_period_end: update.currentPeriodEnd ?? null,
          updated_at: now,
        },
        { onConflict: 'user_id' },
      );
    }
  }
}
