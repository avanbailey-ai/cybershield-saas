/**

 * POST /api/scan — enqueue scan (non-blocking)

 * GET  /api/scan?jobId= — poll job status

 */



import { createClient } from '@/lib/supabase/server';

import { enqueueScan } from '@/lib/scanner/orchestrator';

import { getScanJobStatus, getRecentScanForWebsite } from '@/lib/scanner/jobStatus';

import { requireDashboardAccess } from '@/lib/auth/requireDashboardAccess';

import { getActiveOrgId } from '@/lib/org/context';

import { requirePermission } from '@/lib/auth/rbac';

import { getUserPlan } from '@/lib/billing/planService';

import { rateLimitScan, rateLimitHeaders } from '@/lib/rateLimit/limiter';

import { logApiTiming, recordPerformanceEvent } from '@/lib/observability/log';

import { NextRequest, NextResponse } from 'next/server';

import type { Plan } from '@/lib/billing/plans';



export async function GET(req: NextRequest) {

  const start = Date.now();

  const supabase = await createClient();

  const {

    data: { user },

  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });



  const jobId = req.nextUrl.searchParams.get('jobId');

  if (!jobId) {

    return NextResponse.json({ error: 'jobId query param required' }, { status: 400 });

  }



  const status = await getScanJobStatus(jobId, user.id);

  if (!status) {

    return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  }



  logApiTiming('/api/scan GET', Date.now() - start, 200, { jobId, jobStatus: status.status });



  return NextResponse.json({

    jobId: status.jobId,

    status: status.status,

    score: status.score,

    riskLevel: status.riskLevel,

    scanId: status.scanId,

    error: status.error,

    done: status.status === 'completed' || status.status === 'failed',

  });

}



export async function POST(req: NextRequest) {

  const start = Date.now();

  const supabase = await createClient();

  const {

    data: { user },

  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });



  const access = await requireDashboardAccess(user);

  if (!access.allowed) return access.response;



  const orgId = await getActiveOrgId(user.id);



  try {

    await requirePermission(user.id, orgId, 'run_scans');

  } catch {

    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  }



  const plan = (await getUserPlan(user.id, orgId)) as Plan;

  const rateCheck = rateLimitScan(user.id, plan);

  if (!rateCheck.allowed) {

    logApiTiming('/api/scan POST', Date.now() - start, 429);

    return NextResponse.json(

      { error: 'RATE_LIMITED', message: 'Too many scan requests. Please wait before scanning again.' },

      { status: 429, headers: rateLimitHeaders(rateCheck) },

    );

  }



  const body = await req.json();

  const { websiteId } = body as { websiteId?: string };

  if (!websiteId) return NextResponse.json({ error: 'websiteId is required' }, { status: 400 });



  const enqueueResult = await enqueueScan({ userId: user.id, websiteId, source: 'api', orgId });



  if (!enqueueResult.queued) {

    switch (enqueueResult.reason) {

      case 'website_not_found':

        return NextResponse.json({ error: 'Website not found' }, { status: 404 });



      case 'scan_limit_reached':

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

        return NextResponse.json(

          {

            queued: false,

            already_queued: true,

            jobId: enqueueResult.jobId,

            status: enqueueResult.jobStatus ?? 'pending',

            message: 'Scan already queued or in progress — status updates live',

          },

          { status: 200, headers: rateLimitHeaders(rateCheck) },

        );



      case 'too_recent': {

        const recent = await getRecentScanForWebsite(websiteId, user.id);

        if (recent) {

          logApiTiming('/api/scan POST', Date.now() - start, 200, { cached: true });

          return NextResponse.json(

            {

              success: true,

              cached: true,

              skipped: true,

              score: recent.score,

              riskLevel: recent.riskLevel,

              scanId: recent.scanId,

              result: { score: recent.score, riskLevel: recent.riskLevel },

            },

            { headers: rateLimitHeaders(rateCheck) },

          );

        }

        return NextResponse.json(

          {

            error: 'Scan skipped — this website was scanned recently. Please wait before scanning again.',

            skipped: true,

          },

          { status: 429 },

        );

      }



      case 'rate_limited':

        return NextResponse.json(

          {

            error: enqueueResult.error,

            message: enqueueResult.message ?? 'Too many scan requests. Please wait before scanning again.',

          },

          { status: 429 },

        );



      case 'queue_busy':

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

        return NextResponse.json(

          { error: enqueueResult.error ?? 'Failed to enqueue scan' },

          { status: 500 },

        );

    }

  }



  const durationMs = Date.now() - start;

  logApiTiming('/api/scan POST', durationMs, 202, { jobId: enqueueResult.jobId });

  recordPerformanceEvent('scan_enqueued', { durationMs, jobId: enqueueResult.jobId }, user.id);



  return NextResponse.json(

    {

      success: true,

      queued: true,

      jobId: enqueueResult.jobId,

      status: 'pending',

      message: enqueueResult.queueWarning

        ? 'Scan queued — high demand may increase wait time'

        : 'Scan queued — status updates live via dashboard',

      queueWarning: enqueueResult.queueWarning ?? false,

      queueDepth: enqueueResult.queueDepth,

      durationMs,

    },

    { status: 202, headers: rateLimitHeaders(rateCheck) },

  );

}


