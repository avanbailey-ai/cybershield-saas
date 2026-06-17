import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireDashboardAccess } from '@/lib/auth/requireDashboardAccess';
import { getActiveOrgId } from '@/lib/org/context';
import { requirePermission } from '@/lib/auth/rbac';
import { getUserWithPlan } from '@/lib/billing/planService';
import { getEffectivePlan } from '@/lib/auth/permissions';
import {
  canUsePriorityMonitoring,
  countPriorityMonitoringUsed,
  getPriorityMonitoringSlots,
  PRIORITY_SLOT_LIMIT_MESSAGE,
} from '@/lib/billing/priorityMonitoring';
import { priorityMonitoringSchedulePatch } from '@/lib/jobs/scanFrequency';
import { auditLog, extractIp } from '@/lib/audit/log';

/**
 * PATCH /api/websites/[id]/priority-monitoring
 * Body: { enabled: boolean }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await requireDashboardAccess(user);
  if (!access.allowed) return access.response;

  const orgId = await getActiveOrgId(user.id);

  try {
    await requirePermission(user.id, orgId, 'manage_websites');
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const userWithPlan = await getUserWithPlan(user.id, orgId, user.email);
  if (!canUsePriorityMonitoring(userWithPlan)) {
    return NextResponse.json(
      { error: 'Priority monitoring is available on Agency plans.' },
      { status: 403 },
    );
  }

  const body = (await req.json()) as { enabled?: boolean };
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
  }

  const { id } = await params;
  const admin = createAdminClient();

  const { data: website } = await admin
    .from('websites')
    .select('id, user_id, org_id, priority_monitoring, is_active')
    .eq('id', id)
    .maybeSingle();

  if (!website) {
    return NextResponse.json({ error: 'Website not found' }, { status: 404 });
  }

  const canManage =
    website.user_id === user.id || (orgId && website.org_id === orgId);

  if (!canManage) {
    return NextResponse.json({ error: 'Website not found' }, { status: 404 });
  }

  const currentlyEnabled = website.priority_monitoring === true;
  const enabling = body.enabled && !currentlyEnabled;

  if (enabling) {
    const slotLimit = getPriorityMonitoringSlots(getEffectivePlan(userWithPlan));
    const used = await countPriorityMonitoringUsed(
      admin,
      website.org_id ?? orgId,
      website.user_id,
    );
    if (used >= slotLimit) {
      return NextResponse.json({ error: PRIORITY_SLOT_LIMIT_MESSAGE }, { status: 409 });
    }
  }

  const schedule = priorityMonitoringSchedulePatch(body.enabled);
  const update: Record<string, unknown> = {
    priority_monitoring: body.enabled,
    scan_frequency: schedule.scan_frequency,
    next_scan_at: schedule.next_scan_at,
  };

  if (body.enabled) {
    update.priority_monitoring_enabled_at = new Date().toISOString();
    update.priority_monitoring_enabled_by = user.id;
  }

  const { data: updated, error } = await admin
    .from('websites')
    .update(update)
    .eq('id', id)
    .select('id, priority_monitoring, scan_frequency, next_scan_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  auditLog({
    orgId: website.org_id ?? orgId,
    userId: user.id,
    action: body.enabled ? 'priority_monitoring_enabled' : 'priority_monitoring_disabled',
    metadata: { websiteId: id },
    ip: extractIp(req),
  });

  const usedAfter = await countPriorityMonitoringUsed(
    admin,
    website.org_id ?? orgId,
    website.user_id,
  );
  const limit = getPriorityMonitoringSlots(getEffectivePlan(userWithPlan));

  return NextResponse.json({
    website: updated,
    prioritySlots: { used: usedAfter, limit },
  });
}
