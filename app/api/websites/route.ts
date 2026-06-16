import '@/services/bootstrap';

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireDashboardAccess } from '@/lib/auth/requireDashboardAccess';
import { getUserWithPlan } from '@/lib/billing/planService';
import { getEffectivePlan } from '@/lib/auth/permissions';
import { getActiveOrgId } from '@/lib/org/context';
import { requirePermission } from '@/lib/auth/rbac';
import { auditLog, extractIp } from '@/lib/audit/log';
import {
  canAddWebsite,
  getPlanLimits,
  getWebsiteLimitMessage,
} from '@/core/billing/plans';
import { calculateUsage } from '@/core/usage/calculateUsage';
import { emit } from '@/core/events/emit';
import {
  getUser,
  getWebsitesForUser,
  getWebsiteCountForUser,
  insertWebsite,
} from '@/services/supabaseService';
import { enqueueScan } from '@/services/scanQueueService';
import { processQueuedScansForUser } from '@/lib/scanner/processUserScanQueue';
import { checkAndIncrementScanUsage } from '@/lib/usage/checkScanLimit';
import { buildScanIdempotencyKey } from '@/lib/usage/idempotencyKey';
import { decrementScanUsage } from '@/lib/billing/usageService';
import { findDuplicateWebsiteInOrg } from '@/lib/websites/findDuplicateWebsite';
import { normalizeWebsiteUrlForStorage } from '@/lib/websites/normalizeWebsiteUrl';

export async function GET() {
  const supabase = await createClient();
  const { user } = await getUser(supabase);

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireDashboardAccess(user);
  if (!access.allowed) return access.response;

  const orgId = await getActiveOrgId(user.id);
  const { websites, error } = await getWebsitesForUser(supabase, user.id, orgId);

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json(websites);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { user } = await getUser(supabase);

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireDashboardAccess(user);
  if (!access.allowed) return access.response;

  const orgId = await getActiveOrgId(user.id);

  try {
    await requirePermission(user.id, orgId, 'manage_websites');
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { url, label } = body as { url?: string; label?: string };

  if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 });

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
  }

  let storedUrl: string;
  try {
    storedUrl = normalizeWebsiteUrlForStorage(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
  }

  if (orgId) {
    try {
      const duplicate = await findDuplicateWebsiteInOrg(orgId, url);
      if (duplicate) {
        return NextResponse.json(
          {
            error: 'DUPLICATE_WEBSITE',
            message: 'This website is already monitored in your organization.',
            existingWebsiteId: duplicate.id,
            existingUrl: duplicate.url,
          },
          { status: 409 },
        );
      }
    } catch (dupErr) {
      const message = dupErr instanceof Error ? dupErr.message : 'Duplicate check failed';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const websiteCount = orgId
    ? (
        await supabase
          .from('websites')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId)
      ).count ?? 0
    : await getWebsiteCountForUser(supabase, user.id);
  const userWithPlan = await getUserWithPlan(user.id);
  const plan = getEffectivePlan(userWithPlan);
  const { websiteLimit } = getPlanLimits(plan);
  const usage = calculateUsage({
    websiteCount,
    scanCount: 0,
    alertCount: 0,
    planLimit: websiteLimit,
  });

  if (!canAddWebsite(websiteCount, plan)) {
    void emit({
      type: 'usageLimitReached',
      payload: { userId: user.id, resource: 'websites' },
    });

    const message =
      websiteLimit !== null
        ? getWebsiteLimitMessage(plan, websiteLimit)
        : 'Website limit reached';

    return NextResponse.json(
      {
        error: 'WEBSITE_LIMIT_REACHED',
        message,
        upgradeRequired: usage.atLimit,
        upgradeUrl: '/dashboard/settings',
      },
      { status: 403 },
    );
  }

  const { website, error } = await insertWebsite(supabase, {
    url: storedUrl,
    label: label ?? null,
    userId: user.id,
    orgId,
  });

  if (error || !website) {
    return NextResponse.json({ error: error ?? 'Failed to create website' }, { status: 500 });
  }

  auditLog({
    orgId,
    userId: user.id,
    action: 'website_created',
    metadata: { websiteId: website.id, url },
    ip: extractIp(req),
  });

  const enqueueResult = await (async () => {
    const usageCheck = await checkAndIncrementScanUsage(user.id, plan, orgId);
    if (!usageCheck.allowed) {
      return {
        queued: false as const,
        reason: 'scan_limit_reached' as const,
        error: 'USAGE_LIMIT_REACHED' as const,
        message: usageCheck.reason,
      };
    }

    const result = await enqueueScan({
      userId: user.id,
      websiteId: website.id,
      source: 'api',
      orgId,
      idempotencyKey: buildScanIdempotencyKey(user.id, website.id),
      usagePreChecked: true,
    });

    if (!result.queued && result.reason !== 'duplicate' && result.reason !== 'already_queued') {
      await decrementScanUsage(user.id);
    }

    return result;
  })();

  if (enqueueResult.queued && enqueueResult.jobId) {
    void emit({
      type: 'scanCreated',
      payload: {
        scanId: enqueueResult.jobId,
        websiteId: website.id,
        userId: user.id,
      },
    });
    try {
      await processQueuedScansForUser({ batchLimit: 1 });
    } catch (err) {
      console.error('[websites] Scan worker kick failed (non-fatal):', err);
    }
  }

  return NextResponse.json(
    {
      ...website,
      scanQueued: enqueueResult.queued,
      jobId: enqueueResult.jobId ?? null,
      scanQueueReason: enqueueResult.queued ? null : enqueueResult.reason,
    },
    { status: 201 },
  );
}
