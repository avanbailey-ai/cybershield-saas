/**
 * POST /api/scan
 * Enqueues a single website scan through the orchestrator, then immediately
 * processes the queue (up to 1 job) so the caller gets synchronous results.
 *
 * Returns:
 *   200 — scan queued and processed; includes score + riskLevel
 *   400 — websiteId missing
 *   401 — unauthenticated
 *   403 — plan limit exceeded (USAGE_LIMIT_REACHED or WEBSITE_LIMIT_REACHED)
 *   404 — website not found / not owned by user
 *   409 — already queued or processing
 *   429 — cooldown active or burst rate limit exceeded
 *   500 — unexpected failure
 */

import { createClient } from '@/lib/supabase/server';
import { enqueueScan } from '@/lib/scanner/orchestrator';
import { processQueue } from '@/lib/scanner/processQueue';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { websiteId } = body as { websiteId?: string };
  if (!websiteId) return NextResponse.json({ error: 'websiteId is required' }, { status: 400 });

  // All validation (ownership, plan limits, cooldown, dedup, rate limit) handled by orchestrator
  const enqueueResult = await enqueueScan({ userId: user.id, websiteId, source: 'api' });

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
          { error: 'This website already has a scan queued or in progress', already_queued: true },
          { status: 409 },
        );

      case 'too_recent':
        return NextResponse.json(
          { error: 'Scan skipped — this website was scanned recently. Please wait before scanning again.', skipped: true },
          { status: 429 },
        );

      case 'rate_limited':
        return NextResponse.json(
          {
            error: enqueueResult.error,
            message: enqueueResult.message ?? 'Too many scan requests. Please wait before scanning again.',
          },
          { status: 429 },
        );

      default:
        return NextResponse.json(
          { error: enqueueResult.error ?? 'Failed to enqueue scan' },
          { status: 500 },
        );
    }
  }

  // Process the queue immediately (just this one job) to return synchronous results
  const queueResult = await processQueue(1);
  const jobResult = queueResult.results[0];

  if (!jobResult?.success) {
    return NextResponse.json(
      { error: jobResult?.error ?? 'Scan execution failed' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    queued: true,
    score: jobResult.score,
    riskLevel: jobResult.riskLevel,
    // Legacy shape for frontend compatibility
    result: { score: jobResult.score, riskLevel: jobResult.riskLevel },
    scan: { security_score: jobResult.score },
  });
}
