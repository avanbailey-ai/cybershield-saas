/**
 * POST /api/scan/trigger-all
 * Enqueues all active websites for the authenticated user via the orchestrator.
 * Does NOT execute scans — /api/scan/enqueue-or-process-batch processes the queue.
 *
 * Plan limits, dedup, and rate-limit checks are enforced inside orchestrator.enqueueScan().
 * Scan All bypasses the per-website cooldown so explicit user intent to scan now is honored.
 *
 * Returns a summary including how many were blocked by plan limits.
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { enqueueScan } from '@/lib/scanner/orchestrator';
import { requireDashboardAccess } from '@/lib/auth/requireDashboardAccess';

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireDashboardAccess(user);
  if (!access.allowed) return access.response;

  // Fetch all active websites for this user
  const adminSupabase = createAdminClient();
  const { data: websites, error: fetchErr } = await adminSupabase
    .from('websites')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (fetchErr) {
    return Response.json({ error: 'Failed to fetch websites' }, { status: 500 });
  }

  if (!websites || websites.length === 0) {
    return Response.json({ queued: 0, skipped: 0, blocked: 0, message: 'No active websites found' });
  }

  let queued = 0;
  let skipped = 0;
  let blocked = 0;
  let blockReason: string | undefined;
  let blockMessage: string | undefined;
  let upgradeUrl: string | undefined;
  let rateLimited = false;
  let queueWarning = false;
  let queueBusyBlocked = false;

  for (const website of websites) {
    const result = await enqueueScan({
      userId: user.id,
      websiteId: website.id,
      source: 'api',
      bypassCooldown: true,
    });

    if (result.queued) {
      queued++;
      if (result.queueWarning) queueWarning = true;
    } else if (result.reason === 'queue_busy') {
      queueBusyBlocked = true;
      blockMessage = blockMessage ?? result.message;
      skipped++;
    } else if (result.reason === 'scan_limit_reached' || result.reason === 'website_limit_reached') {
      blocked++;
      blockReason = blockReason ?? result.reason;
      blockMessage = blockMessage ?? result.message;
      upgradeUrl = upgradeUrl ?? result.upgradeUrl;
    } else if (result.reason === 'rate_limited') {
      rateLimited = true;
      skipped++;
    } else {
      skipped++;
    }
  }

  // If queue is at critical capacity and nothing queued
  if (queueBusyBlocked && queued === 0) {
    return Response.json(
      {
        error: 'QUEUE_BUSY',
        message:
          blockMessage ??
          'Scan demand is very high right now. Please try again shortly or upgrade for priority processing.',
        queued: 0,
        skipped,
      },
      { status: 503 },
    );
  }

  // If scan limit was hit and nothing queued, surface it as a 403
  if (blocked > 0 && queued === 0) {
    const isScanLimit = blockReason === 'scan_limit_reached';
    return Response.json(
      {
        error: isScanLimit ? 'USAGE_LIMIT_REACHED' : 'WEBSITE_LIMIT_REACHED',
        message: blockMessage ?? (isScanLimit
          ? 'Daily scan limit reached. Upgrade your plan to scan more websites.'
          : 'Website limit reached for your plan.'),
        queued: 0,
        skipped,
        blocked,
        blockReason,
        upgradeUrl: upgradeUrl ?? '/dashboard/settings',
      },
      { status: 403 },
    );
  }

  if (rateLimited && queued === 0) {
    return Response.json(
      { error: 'Rate limit exceeded — too many scan triggers. Please wait before scanning again.' },
      { status: 429 },
    );
  }

  return Response.json({
    queued,
    skipped,
    blocked,
    queueWarning,
    blockReason: blocked > 0 ? blockReason : undefined,
    upgradeUrl: blocked > 0 ? (upgradeUrl ?? '/dashboard/settings') : undefined,
    message:
      queued === 0
        ? `No websites queued — ${skipped} skipped, ${blocked} blocked by plan limit`
        : `${queued} website(s) queued for scanning${skipped > 0 ? `, ${skipped} skipped` : ''}${blocked > 0 ? `, ${blocked} blocked` : ''}`,
  });
}
