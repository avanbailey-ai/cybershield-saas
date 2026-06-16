/**

 * POST /api/scan — enqueue scan (non-blocking)

 * GET  /api/scan?jobId= — poll job status

 */



import '@/services/bootstrap';



import { createClient } from '@/lib/supabase/server';

import { getScanJobStatus, getRecentScanForWebsite } from '@/lib/scanner/jobStatus';

import { requireDashboardAccess } from '@/lib/auth/requireDashboardAccess';

import { getActiveOrgId } from '@/lib/org/context';

import { requirePermission } from '@/lib/auth/rbac';

import { getUserPlan } from '@/lib/billing/planService';

import { rateLimitScan, rateLimitHeaders } from '@/lib/rateLimit/limiter';

import { logApiTiming } from '@/lib/observability/log';

import {

  addTraceStep,

  completeTrace,

  logEvent,

  startTrace,

} from '@/lib/observability';

import { recordApiLatency } from '@/lib/observability/metrics';

import { resolveRequestTraceId, withTrace } from '@/lib/observability/traceContext';

import { NextRequest, NextResponse } from 'next/server';

import type { Plan } from '@/lib/billing/plans';

import { canUserScan } from '@/core/scans/canUserScan';

import { getPlanLimits } from '@/core/billing/plans';

import { isOrgActive } from '@/core/organizations/isOrgActive';

import { emit } from '@/core/events/emit';

import { getUser, getWebsiteCountForUser } from '@/services/supabaseService';

import { enqueueScan } from '@/services/scanQueueService';
import { kickScanWorker } from '@/lib/scanner/processUserScanQueue';
import { checkAndIncrementScanUsage } from '@/lib/usage/checkScanLimit';
import { buildScanIdempotencyKey } from '@/lib/usage/idempotencyKey';
import { decrementScanUsage } from '@/lib/billing/usageService';

/** Allow scan worker to finish (must match lib/queue/routeConfig.ts). */
export const maxDuration = 180;

export async function GET(req: NextRequest) {

  const start = Date.now();

  const traceId = resolveRequestTraceId(req.headers.get('X-Trace-Id'));



  return withTrace(traceId, async () => {

    const supabase = await createClient();

    const { user } = await getUser(supabase);



    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });



    const jobId = req.nextUrl.searchParams.get('jobId');

    if (!jobId) {

      return NextResponse.json({ error: 'jobId query param required' }, { status: 400 });

    }



    const status = await getScanJobStatus(jobId, user.id);

    if (!status) {

      return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    }



    const durationMs = Date.now() - start;

    logApiTiming('/api/scan GET', durationMs, 200, { jobId, jobStatus: status.status, traceId });

    void recordApiLatency('/api/scan GET', durationMs, 200);



    return NextResponse.json({

      jobId: status.jobId,

      status: status.status,

      score: status.score,

      riskLevel: status.riskLevel,

      scanId: status.scanId,

      error: status.error,

      done: status.status === 'completed' || status.status === 'failed',

      traceId,

    });

  });

}



export async function POST(req: NextRequest) {

  const start = Date.now();

  const traceId = resolveRequestTraceId(req.headers.get('X-Trace-Id'));



  return withTrace(traceId, async () => {

    const supabase = await createClient();

    const { user } = await getUser(supabase);



    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });



    const access = await requireDashboardAccess(user);

    if (!access.allowed) return access.response;



    const orgId = await getActiveOrgId(user.id);



    try {

      await requirePermission(user.id, orgId, 'run_scans');

      await addTraceStep(traceId, 'auth_check', 'auth', { userId: user.id });

    } catch {

      await completeTrace(traceId, 'failed', { reason: 'forbidden' });

      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    }



    const plan = (await getUserPlan(user.id, orgId)) as Plan;

    const rateCheck = rateLimitScan(user.id, plan);

    if (!rateCheck.allowed) {

      const durationMs = Date.now() - start;

      logApiTiming('/api/scan POST', durationMs, 429, { traceId });

      void recordApiLatency('/api/scan POST', durationMs, 429);

      return NextResponse.json(

        { error: 'RATE_LIMITED', message: 'Too many scan requests. Please wait before scanning again.' },

        { status: 429, headers: rateLimitHeaders(rateCheck) },

      );

    }



    let websiteId: string | undefined;

    try {

      const body = await req.json();

      websiteId = (body as { websiteId?: string }).websiteId;

      if (!websiteId) return NextResponse.json({ error: 'websiteId is required' }, { status: 400 });



      await startTrace({

        traceId,

        name: 'scan',

        userId: user.id,

        websiteId,

        metadata: { source: 'api' },

      });



      await logEvent({

        type: 'scan_created',

        layer: 'api',

        userId: user.id,

        orgId,

        traceId,

        metadata: { websiteId },

      });



      const websiteCount = await getWebsiteCountForUser(supabase, user.id);

      const { websiteLimit } = getPlanLimits(plan);

      const scanCheck = canUserScan({

        planWebsiteLimit: websiteLimit,

        currentWebsiteCount: websiteCount,

        isOrgActive: isOrgActive(null),

      });



      await addTraceStep(traceId, 'scan_eligibility', 'scan', {

        allowed: scanCheck.allowed,

        plan,

      });



      if (!scanCheck.allowed && scanCheck.reason?.includes('Add a website')) {

        await completeTrace(traceId, 'failed', { reason: scanCheck.reason });

        return NextResponse.json({ error: scanCheck.reason }, { status: 400 });

      }



      const usageCheck = await checkAndIncrementScanUsage(user.id, plan, orgId);

      if (!usageCheck.allowed) {

        await completeTrace(traceId, 'failed', { reason: 'scan_limit_exceeded' });

        return NextResponse.json(

          {

            error: usageCheck.reason ?? 'Daily scan limit reached',

            code: 'SCAN_LIMIT_EXCEEDED',

            message: usageCheck.reason,

            scansUsed: usageCheck.scansUsed,

            scansLimit: usageCheck.scansLimit,

          },

          { status: 403 },

        );

      }



      const idempotencyKey = buildScanIdempotencyKey(user.id, websiteId);



      const enqueueResult = await enqueueScan({

        userId: user.id,

        websiteId,

        source: 'api',

        orgId,

        traceId,

        idempotencyKey,

        usagePreChecked: true,

      });



      await addTraceStep(traceId, 'enqueue', 'queue', {

        queued: enqueueResult.queued,

        reason: enqueueResult.reason,

        jobId: enqueueResult.jobId,

      });



      if (!enqueueResult.queued) {

        await decrementScanUsage(user.id);

        switch (enqueueResult.reason) {

          case 'website_not_found':

            await completeTrace(traceId, 'failed', { reason: 'website_not_found' });

            return NextResponse.json({ error: 'Website not found' }, { status: 404 });



          case 'scan_limit_reached':

          case 'website_scan_limit':

            await completeTrace(traceId, 'failed', { reason: enqueueResult.reason });

            return NextResponse.json(

              {

                error: enqueueResult.error,

                message: enqueueResult.message,

                upgradeUrl: enqueueResult.upgradeUrl,

                plan: enqueueResult.plan,

                scansUsed: enqueueResult.scansUsed,

                scansLimit: enqueueResult.scansLimit,

              },

              { status: 403 },

            );



          case 'website_limit_reached':

            await completeTrace(traceId, 'failed', { reason: enqueueResult.reason });

            return NextResponse.json(

              {

                error: enqueueResult.error,

                message: enqueueResult.message,

                upgradeUrl: enqueueResult.upgradeUrl,

                plan: enqueueResult.plan,

              },

              { status: 403 },

            );



          case 'already_queued':
            if (enqueueResult.jobId) {
              try {
                await kickScanWorker({
                  batchLimit: 1,
                  jobId: enqueueResult.jobId,
                  source: 'scan',
                  userId: user.id,
                  traceId,
                });
              } catch (err) {
                console.error('[scan] Worker kick on already_queued failed (non-fatal):', err);
              }
            }

            return NextResponse.json(

              {

                queued: false,

                already_queued: true,

                jobId: enqueueResult.jobId,

                status: enqueueResult.jobStatus ?? 'pending',

                message: 'Scan already queued or in progress — status updates live',

                traceId,

              },

              { status: 200, headers: rateLimitHeaders(rateCheck) },

            );



          case 'duplicate':
            if (enqueueResult.jobId) {
              try {
                await kickScanWorker({
                  batchLimit: 1,
                  jobId: enqueueResult.jobId,
                  source: 'scan',
                  userId: user.id,
                  traceId,
                });
              } catch (err) {
                console.error('[scan] Worker kick on duplicate failed (non-fatal):', err);
              }
            }

            return NextResponse.json(

              {

                duplicate: true,

                jobId: enqueueResult.jobId,

                status: enqueueResult.jobStatus ?? 'pending',

                message: 'Scan already requested — returning existing job',

                traceId,

              },

              { status: 200, headers: rateLimitHeaders(rateCheck) },

            );



          case 'too_recent': {

            const recent = await getRecentScanForWebsite(websiteId, user.id);

            if (recent) {

              const durationMs = Date.now() - start;

              logApiTiming('/api/scan POST', durationMs, 200, { cached: true, traceId });

              void recordApiLatency('/api/scan POST', durationMs, 200);

              return NextResponse.json(

                {

                  success: true,

                  cached: true,

                  skipped: true,

                  score: recent.score,

                  riskLevel: recent.riskLevel,

                  scanId: recent.scanId,

                  result: { score: recent.score, riskLevel: recent.riskLevel },

                  traceId,

                },

                { headers: rateLimitHeaders(rateCheck) },

              );

            }

            await completeTrace(traceId, 'failed', { reason: 'too_recent' });

            return NextResponse.json(

              {

                error: 'Scan skipped — this website was scanned recently. Please wait before scanning again.',

                skipped: true,

              },

              { status: 429 },

            );

          }



          case 'rate_limited':

            await completeTrace(traceId, 'failed', { reason: 'rate_limited' });

            return NextResponse.json(

              {

                error: enqueueResult.error,

                message: enqueueResult.message ?? 'Too many scan requests. Please wait before scanning again.',

              },

              { status: 429 },

            );



          case 'queue_busy':

            await completeTrace(traceId, 'failed', { reason: 'queue_busy' });

            return NextResponse.json(

              {

                error: 'QUEUE_BUSY',

                message:

                  enqueueResult.message ??

                  'Scan demand is very high right now. Please try again shortly or upgrade for priority processing.',

                queueDepth: enqueueResult.queueDepth,

              },

              { status: 503 },

            );



          default:

            await completeTrace(traceId, 'failed', { reason: enqueueResult.reason });

            return NextResponse.json(

              { error: enqueueResult.error ?? 'Failed to enqueue scan' },

              { status: 500 },

            );

        }

      }



      if (enqueueResult.jobId) {

        void emit({

          type: 'scanCreated',

          payload: {

            scanId: enqueueResult.jobId,

            websiteId,

            userId: user.id,

          },

        });

        try {
          await kickScanWorker({
            batchLimit: 1,
            jobId: enqueueResult.jobId,
            source: 'scan',
            userId: user.id,
            traceId,
          });
        } catch (err) {
          console.error('[scan] Scan worker kick failed (non-fatal):', err);
        }

      }



      await logEvent({

        type: 'scan_enqueued',

        layer: 'queue',

        userId: user.id,

        orgId,

        traceId,

        metadata: {

          jobId: enqueueResult.jobId,

          websiteId,

          queueDepth: enqueueResult.queueDepth,

        },

      });



      const durationMs = Date.now() - start;

      logApiTiming('/api/scan POST', durationMs, 202, { jobId: enqueueResult.jobId, traceId });

      void recordApiLatency('/api/scan POST', durationMs, 202);



      return NextResponse.json(

        {

          success: true,

          queued: true,

          jobId: enqueueResult.jobId,

          status: 'pending',

          traceId,

          message: enqueueResult.queueWarning

            ? 'Scan queued — high demand may increase wait time'

            : 'Scan queued — status updates live via dashboard',

          queueWarning: enqueueResult.queueWarning ?? false,

          queueDepth: enqueueResult.queueDepth,

          durationMs,

        },

        { status: 202, headers: rateLimitHeaders(rateCheck) },

      );

    } catch (err) {

      await logEvent({

        type: 'scan_failed',

        layer: 'api',

        userId: user.id,

        orgId,

        traceId,

        metadata: {

          websiteId,

          error: err instanceof Error ? err.message : String(err),

        },

      });

      await completeTrace(traceId, 'failed', {

        error: err instanceof Error ? err.message : String(err),

      });

      const durationMs = Date.now() - start;

      void recordApiLatency('/api/scan POST', durationMs, 500);

      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });

    }

  });

}

