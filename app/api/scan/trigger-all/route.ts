/**
 * POST /api/scan/trigger-all
 * Enqueues active websites up to the user's remaining daily scan budget,
 * then processes a bounded batch server-side (no cron required). */

import '@/services/bootstrap';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireDashboardAccess } from '@/lib/auth/requireDashboardAccess';
import { getActiveOrgId } from '@/lib/org/context';
import { requirePermission } from '@/lib/auth/rbac';
import { emit } from '@/core/events/emit';
import { getUser } from '@/services/supabaseService';
import { enqueueScan } from '@/services/scanQueueService';
import { checkAndIncrementScanUsage, getScanUsageStatus } from '@/lib/usage/checkScanLimit';
import { buildScanIdempotencyKey } from '@/lib/usage/idempotencyKey';
import { decrementScanUsage } from '@/lib/billing/usageService';
import { getUserPlan } from '@/lib/billing/planService';
import { generateTraceId, logEvent, startTrace } from '@/lib/observability';
import { recordApiLatency } from '@/lib/observability/metrics';
import { kickScanWorker } from '@/lib/scanner/processUserScanQueue';
import { getScanBatchLimit } from '@/lib/queue/constants';

/** Allow scan worker to finish (must match lib/queue/routeConfig.ts). */
export const maxDuration = 180;

function scanLimitMessage(scansUsed: number, scansLimit: number): string {
  return `You've reached your daily scan limit (${scansLimit}). Used ${scansUsed} of ${scansLimit} today.`;
}

function buildResultMessage(
  queued: number,
  totalWebsites: number,
  scansUsed: number,
  scansLimit: number,
  limitSkipped: number,
): string {
  if (queued === 0 && limitSkipped > 0) {
    return scanLimitMessage(scansUsed, scansLimit);
  }
  if (limitSkipped > 0) {
    return `Queued ${queued} of ${totalWebsites} websites (daily limit: ${scansLimit}, used: ${scansUsed})`;
  }
  if (queued === 0) {
    return 'No websites queued';
  }
  return `Queued ${queued} of ${totalWebsites} websites`;
}

export async function POST() {
  const start = Date.now();
  const traceId = generateTraceId();

  const supabase = await createClient();
  const { user } = await getUser(supabase);

  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireDashboardAccess(user);
  if (!access.allowed) return access.response;

  const orgId = await getActiveOrgId(user.id);

  try {
    await requirePermission(user.id, orgId, 'run_scans');
  } catch {
    void recordApiLatency('/api/scan/trigger-all', Date.now() - start, 403);
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  await startTrace({
    traceId,
    name: 'scan_batch',
    userId: user.id,
    metadata: { source: 'trigger-all' },
  });

  const adminSupabase = createAdminClient();
  let websitesQuery = adminSupabase
    .from('websites')
    .select('id')
    .eq('is_active', true);
  websitesQuery = orgId
    ? websitesQuery.eq('org_id', orgId)
    : websitesQuery.eq('user_id', user.id);
  const { data: websites, error: fetchErr } = await websitesQuery;

  if (fetchErr) {
    void recordApiLatency('/api/scan/trigger-all', Date.now() - start, 500);
    return Response.json({ error: 'Failed to fetch websites' }, { status: 500 });
  }

  const totalWebsites = websites?.length ?? 0;

  if (!websites || totalWebsites === 0) {
    void recordApiLatency('/api/scan/trigger-all', Date.now() - start, 200);
    return Response.json({
      queued: 0,
      skipped: 0,
      remaining: 0,
      limitExceeded: false,
      message: 'No active websites found',
      traceId,
    });
  }

  const plan = await getUserPlan(user.id);
  const usageStatus = await getScanUsageStatus(user.id);
  const { scansUsed, scansLimit, remaining } = usageStatus;

  if (remaining !== Infinity && remaining <= 0) {
    void recordApiLatency('/api/scan/trigger-all', Date.now() - start, 403);
    const message = scanLimitMessage(scansUsed, scansLimit);
    return Response.json(
      {
        error: message,
        code: 'SCAN_LIMIT_EXCEEDED',
        message,
        scansUsed,
        scansLimit,
        queued: 0,
        skipped: totalWebsites,
        remaining: 0,
        limitExceeded: true,
        traceId,
      },
      { status: 403 },
    );
  }

  let queued = 0;
  let skipped = 0;
  let limitSkipped = 0;
  let websiteLimitBlocked = 0;
  let blockMessage: string | undefined;
  let upgradeUrl: string | undefined;
  let rateLimited = false;
  let queueWarning = false;
  let queueBusyBlocked = false;

  let scansBudget = remaining === Infinity ? totalWebsites : remaining;

  for (const website of websites) {
    if (scansBudget <= 0) {
      limitSkipped++;
      skipped++;
      continue;
    }

    const usageCheck = await checkAndIncrementScanUsage(user.id, plan);
    if (!usageCheck.allowed) {
      limitSkipped++;
      skipped++;
      blockMessage = usageCheck.reason ?? blockMessage;
      continue;
    }

    const result = await enqueueScan({
      userId: user.id,
      websiteId: website.id,
      source: 'api',
      bypassCooldown: true,
      traceId,
      idempotencyKey: buildScanIdempotencyKey(user.id, website.id),
      usagePreChecked: true,
    });

    if (!result.queued) {
      await decrementScanUsage(user.id);
    }

    if (result.queued) {
      scansBudget--;
      queued++;
      if (result.queueWarning) queueWarning = true;

      await logEvent({
        type: 'scan_enqueued',
        layer: 'queue',
        userId: user.id,
        traceId,
        metadata: { jobId: result.jobId, websiteId: website.id, batch: true },
      });

      if (result.jobId) {
        void emit({
          type: 'scanCreated',
          payload: {
            scanId: result.jobId,
            websiteId: website.id,
            userId: user.id,
          },
        });
      }
    } else if (result.reason === 'queue_busy') {
      queueBusyBlocked = true;
      blockMessage = blockMessage ?? result.message;
      skipped++;
    } else if (
      result.reason === 'scan_limit_reached' ||
      result.reason === 'website_limit_reached' ||
      result.reason === 'website_scan_limit'
    ) {
      if (result.reason === 'scan_limit_reached' || result.reason === 'website_scan_limit') {
        limitSkipped++;
      } else {
        websiteLimitBlocked++;
      }
      skipped++;
      blockMessage = blockMessage ?? result.message;
      upgradeUrl = upgradeUrl ?? result.upgradeUrl;
    } else if (result.reason === 'rate_limited') {
      rateLimited = true;
      skipped++;
    } else {
      skipped++;
    }
  }

  const limitExceeded = limitSkipped > 0;
  const remainingAfter =
    remaining === Infinity ? Infinity : Math.max(0, remaining - queued);
  const message = buildResultMessage(queued, totalWebsites, scansUsed, scansLimit, limitSkipped);

  void recordApiLatency('/api/scan/trigger-all', Date.now() - start, 200);

  if (queueBusyBlocked && queued === 0) {
    return Response.json(
      {
        error: 'QUEUE_BUSY',
        message:
          blockMessage ??
          'Scan demand is very high right now. Please try again shortly or upgrade for priority processing.',
        queued: 0,
        skipped,
        remaining: remainingAfter === Infinity ? scansLimit : remainingAfter,
        limitExceeded,
        scansUsed,
        scansLimit,
        traceId,
      },
      { status: 503 },
    );
  }

  if (queued === 0 && limitExceeded) {
    return Response.json(
      {
        error: blockMessage ?? scanLimitMessage(scansUsed, scansLimit),
        code: 'SCAN_LIMIT_EXCEEDED',
        message: blockMessage ?? scanLimitMessage(scansUsed, scansLimit),
        scansUsed,
        scansLimit,
        queued: 0,
        skipped,
        remaining: 0,
        limitExceeded: true,
        traceId,
      },
      { status: 403 },
    );
  }

  if (websiteLimitBlocked > 0 && queued === 0) {
    return Response.json(
      {
        error: 'WEBSITE_LIMIT_REACHED',
        message: blockMessage ?? 'Website limit reached for your plan.',
        queued: 0,
        skipped,
        remaining: remainingAfter === Infinity ? scansLimit : remainingAfter,
        limitExceeded,
        scansUsed,
        scansLimit,
        upgradeUrl: upgradeUrl ?? '/dashboard/settings',
        traceId,
      },
      { status: 403 },
    );
  }

  if (rateLimited && queued === 0) {
    return Response.json(
      {
        error: 'Rate limit exceeded — too many scan triggers. Please wait before scanning again.',
        queued: 0,
        skipped,
        remaining: remainingAfter === Infinity ? scansLimit : remainingAfter,
        limitExceeded,
        traceId,
      },
      { status: 429 },
    );
  }

  if (queued > 0) {
    try {
      await kickScanWorker({
        batchLimit: Math.min(queued, getScanBatchLimit()),
        source: 'trigger-all',
        userId: user.id,
        traceId,
      });
    } catch (err) {
      console.error('[trigger-all] Scan worker kick failed (non-fatal):', err);
    }
  }

  return Response.json({
    queued,
    skipped,
    remaining: remainingAfter === Infinity ? scansLimit : remainingAfter,
    limitExceeded,
    scansUsed,
    scansLimit,
    queueWarning,
    traceId,
    upgradeUrl: limitExceeded ? (upgradeUrl ?? '/dashboard/settings') : undefined,
    message,
  });
}
