/**
 * orchestrator.ts — Billing-aware scan enqueueing gateway.
 *
 * This is the ONLY allowed entry point for inserting into scan_queue.
 * Every scan request passes through here before touching the queue.
 *
 * Enforcement order:
 *   1. Validate website ownership
 *   2. Check daily scan limit (plan-gated)         ← billing enforcement
 *   3. Check website limit (plan-gated, api/manual only)
 *   4. 10-minute per-website cooldown (api/manual only)
 *   5. Duplicate pending/processing job check
 *   6. 60-second burst rate limit (api/manual only)
 *   7. Increment usage counter atomically
 *   8. Insert job into scan_queue
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { getUserPlan, getPlanLimits, type Plan } from '@/lib/billing/planService';
import { canAddWebsite, canRunScan } from '@/lib/billing/guards';
import { getUsage, incrementScanUsage, decrementScanUsage, getUserWebsiteCount } from '@/lib/billing/usageService';

export type ScanSource = 'api' | 'manual' | 'cron';

export interface EnqueueResult {
  queued: boolean;
  jobId?: string;
  /** Reason when queued === false */
  reason?:
    | 'too_recent'
    | 'already_queued'
    | 'rate_limited'
    | 'website_not_found'
    | 'scan_limit_reached'
    | 'website_limit_reached'
    | 'queue_error'
    | 'error';
  /** Machine-readable error code for API consumers */
  error?: 'USAGE_LIMIT_REACHED' | 'WEBSITE_LIMIT_REACHED' | 'RATE_LIMITED' | string;
  /** Human-readable message safe to show in the UI */
  message?: string;
  /** Link to the upgrade page */
  upgradeUrl?: string;
  /** User's current plan (included on limit errors for UI display) */
  plan?: Plan;
  scansUsed?: number;
  scansLimit?: number;
}

const SCAN_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes — cooldown per website
const RATE_LIMIT_WINDOW_MS = 60 * 1000;  // 60-second burst window
const RATE_LIMIT_MAX_SCANS = 25;          // max queue inserts per user per minute (api/manual)

export async function enqueueScan(params: {
  userId: string;
  websiteId: string;
  source: ScanSource;
}): Promise<EnqueueResult> {
  const { userId, websiteId, source } = params;

  console.log(
    `[ORCHESTRATOR] ${new Date().toISOString()} — enqueueScan source=${source} websiteId=${websiteId} userId=${userId}`,
  );

  const supabase = createAdminClient();

  // ── 1. Validate website ownership ─────────────────────────────────────────
  const { data: website, error: wErr } = await supabase
    .from('websites')
    .select('id, last_scanned_at')
    .eq('id', websiteId)
    .eq('user_id', userId)
    .single();

  if (wErr || !website) {
    console.warn(`[ORCHESTRATOR] website_not_found — websiteId=${websiteId} userId=${userId}`);
    return { queued: false, reason: 'website_not_found' };
  }

  // ── 2. Billing: daily scan limit ──────────────────────────────────────────
  const plan = await getUserPlan(userId);
  const limits = getPlanLimits(plan);
  const today = new Date().toISOString().split('T')[0];
  const usage = await getUsage(userId, today);

  const scanCheck = canRunScan({ id: userId, plan }, usage.scans_used);
  if (!scanCheck.allowed) {
    console.warn(
      `[ORCHESTRATOR] BLOCK reason=scan_limit_reached user=${userId} plan=${plan} scansToday=${usage.scans_used} limit=${limits.maxScansPerDay}`,
    );
    return {
      queued: false,
      reason: 'scan_limit_reached',
      error: 'USAGE_LIMIT_REACHED',
      message: scanCheck.message,
      upgradeUrl: '/dashboard/settings',
      plan,
      scansUsed: usage.scans_used,
      scansLimit: limits.maxScansPerDay,
    };
  }

  // ── 3. Billing: website limit (skip for cron — cron scans existing sites) ─
  if (source !== 'cron' && limits.maxWebsites !== Infinity) {
    const websiteCount = await getUserWebsiteCount(userId);
    if (websiteCount > limits.maxWebsites) {
      const websiteCheck = canAddWebsite({ id: userId, plan }, websiteCount);
      console.warn(
        `[ORCHESTRATOR] BLOCK reason=website_limit_reached user=${userId} plan=${plan} websites=${websiteCount} limit=${limits.maxWebsites}`,
      );
      return {
        queued: false,
        reason: 'website_limit_reached',
        error: 'WEBSITE_LIMIT_REACHED',
        message: websiteCheck.message,
        upgradeUrl: '/dashboard/settings',
        plan,
      };
    }
  }

  // ── 4. Cooldown: skip for cron ─────────────────────────────────────────────
  if (source !== 'cron' && website.last_scanned_at) {
    const msSinceScan = Date.now() - new Date(website.last_scanned_at).getTime();
    if (msSinceScan < SCAN_COOLDOWN_MS) {
      const remainingSecs = Math.ceil((SCAN_COOLDOWN_MS - msSinceScan) / 1000);
      console.log(
        `[ORCHESTRATOR] too_recent — websiteId=${websiteId} cooldown=${remainingSecs}s remaining`,
      );
      return { queued: false, reason: 'too_recent' };
    }
  }

  // ── 5. Duplicate job check ─────────────────────────────────────────────────
  const { data: existingJobs } = await supabase
    .from('scan_queue')
    .select('id, status')
    .eq('website_id', websiteId)
    .in('status', ['pending', 'processing'])
    .limit(1);

  if (existingJobs && existingJobs.length > 0) {
    console.log(
      `[ORCHESTRATOR] already_queued — websiteId=${websiteId} status=${existingJobs[0].status}`,
    );
    return { queued: false, reason: 'already_queued' };
  }

  // ── 6. Burst rate limit: api/manual only ───────────────────────────────────
  if (source !== 'cron') {
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count: recentJobs } = await supabase
      .from('scan_queue')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', windowStart);

    if ((recentJobs ?? 0) >= RATE_LIMIT_MAX_SCANS) {
      console.warn(
        `[ORCHESTRATOR] rate_limited — userId=${userId} recentJobs=${recentJobs}/${RATE_LIMIT_MAX_SCANS} in last 60s`,
      );
      return {
        queued: false,
        reason: 'rate_limited',
        error: 'RATE_LIMITED',
        message: 'Too many scan requests in the last 60 seconds. Please wait before scanning again.',
      };
    }
  }

  // ── 7. Increment usage counter BEFORE queue insert ─────────────────────────
  // This ensures usage is tracked even if the queue insert fails.
  await incrementScanUsage(userId);

  // ── 8. Insert job — the ONLY place that writes to scan_queue ───────────────
  try {
    const { data: job, error: insertErr } = await supabase
      .from('scan_queue')
      .insert({ website_id: websiteId, user_id: userId, status: 'pending', source })
      .select('id')
      .single();

    if (insertErr) throw insertErr;

    console.log(
      `[ORCHESTRATOR] ALLOW source=${source} websiteId=${websiteId} jobId=${job.id} plan=${plan} scansToday=${usage.scans_used + 1}/${limits.maxScansPerDay}`,
    );
    return { queued: true, jobId: job.id };
  } catch (err) {
    // Compensate: decrement usage since scan was never queued
    try {
      await decrementScanUsage(userId);
    } catch (compensateErr) {
      console.error('[ORCHESTRATOR] Failed to compensate usage decrement after failed insert', { userId, err: compensateErr });
    }
    console.error('[ORCHESTRATOR] Queue insert failed', { userId, websiteId, err });
    return { queued: false, reason: 'queue_error', message: 'Failed to queue scan. Please try again.' };
  }
}
