/**
 * enforceScan.ts — Single billing gate before scan_queue insert.
 *
 * Checks:
 *   1. Owner bypass
 *   2. Paid plans require active/trialing subscription (free tier exempt)
 *   3. Daily scan usage below effective plan limit (UTC day)
 */

import { isOwner } from '@/lib/auth/owner';
import { canRunScan, getEffectivePlan, type UserWithPlan } from '@/lib/auth/permissions';
import type { Plan } from './plans';
import { getEffectiveMaxScansPerDay, getUserProfile, getUserWithPlan } from './planService';
import { getUserSubscription, isPaidPlan, isSubscriptionActive } from './subscriptionService';
import { getTodayUtc, getUsage } from './usageService';

export type EnforceScanReason = 'upgrade_required' | 'scan_limit_reached' | 'subscription_inactive';

export type EnforceScanResult =
  | {
      allowed: true;
      plan: Plan;
      scansUsed: number;
      scansLimit: number;
    }
  | {
      allowed: false;
      reason: EnforceScanReason;
      message: string;
      upgradeUrl: string;
      plan: Plan;
      scansUsed: number;
      scansLimit: number;
    };

const UPGRADE_URL = '/dashboard/settings';

function deny(
  reason: EnforceScanReason,
  message: string,
  plan: Plan,
  scansUsed: number,
  scansLimit: number,
): EnforceScanResult {
  return {
    allowed: false,
    reason,
    message,
    upgradeUrl: UPGRADE_URL,
    plan,
    scansUsed,
    scansLimit,
  };
}

/** Central scan billing gate — call before any scan_queue insert. */
export async function enforceScanLimit(userId: string): Promise<EnforceScanResult> {
  const [profile, subscription] = await Promise.all([
    getUserProfile(userId),
    getUserSubscription(userId),
  ]);

  const userWithPlan: UserWithPlan = {
    id: userId,
    email: profile.email,
    plan: profile.plan,
    subscription_status: subscription.status,
  };

  if (isOwner(profile.email)) {
    return { allowed: true, plan: 'owner', scansUsed: 0, scansLimit: Infinity };
  }

  const plan = getEffectivePlan(userWithPlan);
  const today = getTodayUtc();
  const usage = await getUsage(userId, today);
  const scansLimit = await getEffectiveMaxScansPerDay(userId);

  if (isPaidPlan(plan) && !isSubscriptionActive(subscription.status)) {
    return deny(
      'upgrade_required',
      'An active subscription is required to run scans on your plan. Please renew or upgrade.',
      plan,
      usage.scans_used,
      scansLimit,
    );
  }

  const scanCheck = canRunScan(userWithPlan, usage.scans_used, scansLimit);
  if (!scanCheck.allowed) {
    const reason: EnforceScanReason =
      plan === 'free' || !isSubscriptionActive(subscription.status)
        ? 'upgrade_required'
        : 'scan_limit_reached';

    return deny(
      reason,
      scanCheck.message ?? `Daily scan limit reached (${scansLimit}/day).`,
      plan,
      usage.scans_used,
      scansLimit,
    );
  }

  return { allowed: true, plan, scansUsed: usage.scans_used, scansLimit };
}
