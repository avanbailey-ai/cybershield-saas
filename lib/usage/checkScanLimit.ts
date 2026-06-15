/**
 * Single source of truth for daily scan usage — check and increment atomically via RPC.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { Plan } from '@/lib/billing/plans';
import { getEffectiveMaxScansPerDay, getUserProfile } from '@/lib/billing/planService';
import { getTodayUtc, getUsage } from '@/lib/billing/usageService';
import { isOwner } from '@/lib/auth/owner';
import { canRunScan, getEffectivePlan } from '@/lib/auth/permissions';
import { getUserWithPlan } from '@/lib/billing/planService';

export interface ScanUsageCheckResult {
  allowed: boolean;
  reason?: string;
  remaining?: number;
  scansUsed?: number;
  scansLimit?: number;
}

export interface ScanUsageStatus {
  scansUsed: number;
  scansLimit: number;
  remaining: number;
}

/** Read-only snapshot of today's scan allowance (no increment). */
export async function getScanUsageStatus(
  userId: string,
  orgId?: string | null,
): Promise<ScanUsageStatus> {
  const profile = await getUserProfile(userId);
  if (isOwner(profile.email)) {
    return { scansUsed: 0, scansLimit: Infinity, remaining: Infinity };
  }

  const [scansLimit, usage] = await Promise.all([
    getEffectiveMaxScansPerDay(userId, orgId),
    getUsage(userId, getTodayUtc()),
  ]);

  const remaining =
    scansLimit === Infinity ? Infinity : Math.max(0, scansLimit - usage.scans_used);

  return { scansUsed: usage.scans_used, scansLimit, remaining };
}

/**
 * Atomically verify daily scan allowance and increment usage before enqueue.
 * Syncs plan from profiles on each call via getEffectiveMaxScansPerDay.
 */
function logScanLimit(
  event: 'scan_allowed' | 'scan_blocked',
  details: Record<string, unknown>,
): void {
  console.log(`[scan-limit] ${event}`, details);
}

export async function checkAndIncrementScanUsage(
  userId: string,
  plan: Plan,
  orgId?: string | null,
): Promise<ScanUsageCheckResult> {
  const profile = await getUserProfile(userId);
  if (isOwner(profile.email)) {
    logScanLimit('scan_allowed', { userId, orgId, plan: 'owner', reason: 'owner_bypass' });
    return { allowed: true, remaining: Infinity, scansUsed: 0, scansLimit: Infinity };
  }

  const scansLimit = await getEffectiveMaxScansPerDay(userId, orgId);
  const maxScans = scansLimit === Infinity ? 2147483647 : scansLimit;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('check_and_increment_scan_usage', {
    p_user_id: userId,
    p_max_scans: maxScans,
  });

  if (error) {
    const userWithPlan = await getUserWithPlan(userId, orgId);
    const today = getTodayUtc();
    const usage = await getUsage(userId, today);
    const scanCheck = canRunScan(userWithPlan, usage.scans_used, scansLimit);
    if (!scanCheck.allowed) {
      const reason = scanCheck.message ?? 'Daily scan limit reached';
      logScanLimit('scan_blocked', {
        userId,
        orgId,
        plan,
        reason,
        scansUsed: usage.scans_used,
        scansLimit,
      });
      return {
        allowed: false,
        reason,
        scansUsed: usage.scans_used,
        scansLimit,
        remaining: 0,
      };
    }
    const { error: incErr } = await admin.rpc('increment_scan_usage', { p_user_id: userId });
    if (incErr) {
      logScanLimit('scan_blocked', {
        userId,
        orgId,
        plan,
        reason: 'unable_to_record_usage',
        scansUsed: usage.scans_used,
        scansLimit,
      });
      return {
        allowed: false,
        reason: 'Unable to record scan usage',
        scansUsed: usage.scans_used,
        scansLimit,
        remaining: 0,
      };
    }
    const nextUsed = usage.scans_used + 1;
    logScanLimit('scan_allowed', {
      userId,
      orgId,
      plan,
      scansUsed: nextUsed,
      scansLimit,
      remaining: scansLimit === Infinity ? undefined : Math.max(0, scansLimit - nextUsed),
    });
    return {
      allowed: true,
      scansUsed: nextUsed,
      scansLimit,
      remaining: scansLimit === Infinity ? undefined : Math.max(0, scansLimit - nextUsed),
    };
  }

  const payload = data as {
    allowed?: boolean;
    reason?: string;
    scans_used?: number;
    remaining?: number | null;
  };

  if (!payload.allowed) {
    const effectivePlan = getEffectivePlan({ plan, email: profile.email });
    const upgrade =
      effectivePlan === 'free'
        ? 'Pro'
        : effectivePlan === 'pro'
          ? 'Growth'
          : effectivePlan === 'growth'
            ? 'Agency'
            : null;
    const message =
      payload.reason ??
      (upgrade
        ? `Upgrade to ${upgrade} for more daily scans`
        : `You've reached your daily scan limit (${scansLimit})`);

    logScanLimit('scan_blocked', {
      userId,
      orgId,
      plan,
      reason: message,
      scansUsed: payload.scans_used ?? scansLimit,
      scansLimit,
    });
    return {
      allowed: false,
      reason: message,
      scansUsed: payload.scans_used ?? scansLimit,
      scansLimit,
      remaining: 0,
    };
  }

  logScanLimit('scan_allowed', {
    userId,
    orgId,
    plan,
    scansUsed: payload.scans_used,
    scansLimit,
    remaining: payload.remaining ?? undefined,
  });
  return {
    allowed: true,
    scansUsed: payload.scans_used,
    scansLimit,
    remaining:
      payload.remaining === null || payload.remaining === undefined
        ? undefined
        : payload.remaining,
  };
}
