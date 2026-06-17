/**

 * orchestrator.ts — Billing-aware scan enqueueing gateway.

 *

 * This is the ONLY allowed entry point for inserting into scan_queue.

 * Every scan request passes through here before touching the queue.

 */



import { createAdminClient } from '@/lib/supabase/admin';

import { getUserWithPlan, getPlanLimits, getUserProfile } from '@/lib/billing/planService';

import { enforceScanLimit } from '@/lib/billing/enforceScan';

import { canAddWebsite, getEffectivePlan } from '@/lib/auth/permissions';

import { incrementScanUsage, getUserWebsiteCount } from '@/lib/billing/usageService';

import { getActiveOrgId, getOrganization } from '@/lib/org/context';

import { getOrgHourlyScanLimit } from '@/lib/billing/orgPlans';

import { auditLog } from '@/lib/audit/log';

import { domainFromUrl } from '@/lib/queue/domain';

import { getPlanQueuePriority, PLAN_LIMITS } from '@/lib/billing/plans';

import { trackServerEvent } from '@/lib/analytics/trackServerEvent';

import { checkQueueBackpressure } from './backpressure';

import {

  RATE_LIMIT_MAX_SCANS,

  RATE_LIMIT_WINDOW_MS,

  cooldownRemainingMs,

} from './enqueueLimits';

import type { EnqueueResult, ScanSource } from './enqueueTypes';



export type { EnqueueResult, ScanSource } from './enqueueTypes';



export async function enqueueScan(params: {

  userId: string;

  websiteId: string;

  source: ScanSource;

  orgId?: string | null;

  bypassCooldown?: boolean;

  traceId?: string | null;

  idempotencyKey?: string;

  /** Caller already ran checkAndIncrementScanUsage — skips duplicate increment only. */
  usagePreChecked?: boolean;

  /** Cron monitoring vs weekly deep scan classification. */
  monitoringScanKind?: 'monitoring_check' | 'deep_scan';

}): Promise<EnqueueResult> {

  const {
    userId,
    websiteId,
    source,
    bypassCooldown = false,
    traceId = null,
    idempotencyKey,
    usagePreChecked = false,
    monitoringScanKind,
  } = params;

  let orgId = params.orgId ?? null;



  console.log(

    `[ORCHESTRATOR] ${new Date().toISOString()} — enqueueScan source=${source} websiteId=${websiteId} userId=${userId}`,

  );



  const supabase = createAdminClient();



  const { data: website, error: wErr } = await supabase

    .from('websites')

    .select('id, last_scanned_at, org_id, user_id, url')

    .eq('id', websiteId)

    .single();



  if (wErr || !website) {

    console.warn(`[ORCHESTRATOR] website_not_found — websiteId=${websiteId} userId=${userId}`);

    return { queued: false, reason: 'website_not_found' };

  }



  if (website.user_id !== userId) {

    if (!website.org_id) {

      console.warn(`[ORCHESTRATOR] website_not_found — websiteId=${websiteId} userId=${userId}`);

      return { queued: false, reason: 'website_not_found' };

    }

    const { data: membership } = await supabase

      .from('organization_members')

      .select('org_id')

      .eq('user_id', userId)

      .eq('org_id', website.org_id)

      .maybeSingle();

    if (!membership) {

      console.warn(`[ORCHESTRATOR] website_not_found — websiteId=${websiteId} userId=${userId}`);

      return { queued: false, reason: 'website_not_found' };

    }

  }



  if (!orgId) {

    orgId = website.org_id ?? (await getActiveOrgId(userId));

  }



  const billingGate = await enforceScanLimit(
    userId,
    orgId,
    usagePreChecked ? { skipDailyLimit: true } : undefined,
  );

  const plan = billingGate.plan;

  if (!billingGate.allowed) {

    console.warn(

      `[scan-limit] scan_blocked reason=${billingGate.reason} user=${userId} orgId=${orgId} plan=${plan} scansToday=${billingGate.scansUsed} limit=${billingGate.scansLimit} source=${source}`,

    );

    return {

      queued: false,

      reason: 'scan_limit_reached',

      error: 'USAGE_LIMIT_REACHED',

      message: billingGate.message,

      upgradeUrl: billingGate.upgradeUrl,

      plan,

      scansUsed: billingGate.scansUsed,

      scansLimit: billingGate.scansLimit,

    };

  }



  const userWithPlan = await getUserWithPlan(userId, orgId);

  const limits = getPlanLimits(plan);



  if (limits.maxWebsites !== Infinity) {

    const websiteCount = await getUserWebsiteCount(userId, orgId);

    if (websiteCount > limits.maxWebsites) {

      const websiteCheck = canAddWebsite(userWithPlan, websiteCount);

      console.warn(

        `[ORCHESTRATOR] BLOCK reason=website_limit_reached user=${userId} orgId=${orgId} plan=${plan} websites=${websiteCount} limit=${limits.maxWebsites}`,

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



  if (!bypassCooldown && source !== 'cron' && website.last_scanned_at) {

    const remainingMs = cooldownRemainingMs(website.last_scanned_at);

    if (remainingMs > 0) {

      const remainingSecs = Math.ceil(remainingMs / 1000);

      console.log(

        `[ORCHESTRATOR] too_recent — websiteId=${websiteId} cooldown=${remainingSecs}s remaining`,

      );

      return { queued: false, reason: 'too_recent' };

    }

  }



  const { data: existingJobs } = await supabase

    .from('scan_queue')

    .select('id, status')

    .eq('website_id', websiteId)

    .eq('user_id', userId)

    .in('status', ['pending', 'processing'])

    .limit(1);



  if (existingJobs && existingJobs.length > 0) {

    console.log(

      `[ORCHESTRATOR] already_queued — websiteId=${websiteId} userId=${userId} status=${existingJobs[0].status}`,

    );

    return {

      queued: false,

      reason: 'already_queued',

      jobId: existingJobs[0].id,

      jobStatus: existingJobs[0].status as 'pending' | 'processing',

    };

  }



  // Free tier: one completed scan per website (lifetime) unless pro unlock is active

  if (plan === 'free') {

    const profile = await getUserProfile(userId);

    const proUnlockActive =

      profile.pro_unlock_until !== null && new Date(profile.pro_unlock_until) > new Date();

    if (!proUnlockActive) {

      const { count: completedForWebsite } = await supabase

        .from('scans')

        .select('id', { count: 'exact', head: true })

        .eq('website_id', websiteId)

        .eq('user_id', userId)

        .eq('status', 'completed');



      const maxPerWebsite = PLAN_LIMITS.free.maxScansPerWebsite ?? 1;

      if ((completedForWebsite ?? 0) >= maxPerWebsite) {

        console.warn(

          `[ORCHESTRATOR] BLOCK reason=website_scan_limit user=${userId} websiteId=${websiteId} completed=${completedForWebsite}`,

        );

        return {

          queued: false,

          reason: 'website_scan_limit',

          error: 'USAGE_LIMIT_REACHED',

          message:

            'Free plan allows one scan per website. Upgrade to scan again or add continuous monitoring.',

          upgradeUrl: '/onboarding',

          plan,

          scansUsed: billingGate.scansUsed,

          scansLimit: billingGate.scansLimit,

        };

      }

    }

  }



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



  if (orgId && source !== 'cron') {

    const org = await getOrganization(orgId);

    const orgPlan = org?.plan ?? 'free';

    const hourlyLimit = getOrgHourlyScanLimit(orgPlan);

    const hourStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { count: orgRecentScans } = await supabase

      .from('scan_queue')

      .select('id', { count: 'exact', head: true })

      .eq('org_id', orgId)

      .gte('created_at', hourStart);



    if ((orgRecentScans ?? 0) >= hourlyLimit) {

      console.warn(

        `[ORCHESTRATOR] org_rate_limited — orgId=${orgId} recent=${orgRecentScans}/${hourlyLimit}`,

      );

      return {

        queued: false,

        reason: 'rate_limited',

        error: 'RATE_LIMITED',

        message: 'Organization hourly scan limit reached. Please wait before scanning again.',

      };

    }

  }



  const backpressure = await checkQueueBackpressure();

  if (!backpressure.allowed) {

    console.warn(

      `[ORCHESTRATOR] backpressure — depth=${backpressure.depth} reason=${backpressure.reason}`,

    );

    return {

      queued: false,

      reason: 'queue_busy',

      message: backpressure.message,

    };

  }



  try {

    const { data: job, error: insertErr } = await supabase

      .from('scan_queue')

      .insert({

        website_id: websiteId,

        user_id: userId,

        org_id: orgId,

        domain: domainFromUrl(website.url),

        status: 'pending',

        source,

        attempts: 0,

        max_attempts: 3,

        priority: getPlanQueuePriority(plan),

        ...(traceId ? { trace_id: traceId } : {}),

        ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),

      })

      .select('id')

      .single();



    if (insertErr) {

      if (idempotencyKey && insertErr.code === '23505') {

        const { data: existing } = await supabase

          .from('scan_queue')

          .select('id, status')

          .eq('idempotency_key', idempotencyKey)

          .maybeSingle();

        if (existing) {

          return {

            queued: false,

            reason: 'duplicate',

            jobId: existing.id,

            jobStatus: existing.status as 'pending' | 'processing' | 'completed' | 'failed',

          };

        }

      }

      throw insertErr;

    }



    if (!usagePreChecked) {

      await incrementScanUsage(userId);

    }



    auditLog({

      orgId,

      userId,

      action: 'scan_enqueued',

      metadata: { websiteId, jobId: job.id, source },

    });



    const { data: scanRow, error: scanInsertErr } = await supabase

      .from('scans')

      .insert({

        website_id: websiteId,

        user_id: userId,

        org_id: orgId,

        status: 'pending',

        started_at: new Date().toISOString(),

        scan_kind:
          monitoringScanKind ?? (source === 'cron' ? 'monitoring_check' : 'deep_scan'),

      })

      .select('id')

      .single();



    if (scanInsertErr) {

      console.error('[ORCHESTRATOR] scan SSOT record create failed', {

        websiteId,

        jobId: job.id,

        err: scanInsertErr,

      });

    } else if (scanRow) {

      const { error: linkErr } = await supabase

        .from('scan_queue')

        .update({ scan_id: scanRow.id })

        .eq('id', job.id);



      if (linkErr) {

        console.error('[ORCHESTRATOR] scan_queue scan_id link failed', {

          jobId: job.id,

          scanId: scanRow.id,

          err: linkErr,

        });

      }

    }



    void trackServerEvent(

      'scan_created',

      { websiteId, jobId: job.id, source, plan, queueDepth: backpressure.depth },

      userId,

    );



    console.log(

      `[scan-limit] scan_allowed source=${source} websiteId=${websiteId} jobId=${job.id} userId=${userId} orgId=${orgId} plan=${plan} scansToday=${billingGate.scansUsed}/${billingGate.scansLimit} usagePreChecked=${usagePreChecked}`,

    );

    return {

      queued: true,

      jobId: job.id,

      queueWarning: backpressure.warning,

      queueDepth: backpressure.depth,

    };

  } catch (err) {

    console.error('[ORCHESTRATOR] Queue insert failed', { userId, websiteId, err });

    return { queued: false, reason: 'queue_error', message: 'Failed to queue scan. Please try again.' };

  }

}


