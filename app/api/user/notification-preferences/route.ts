import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '@/lib/notifications/preferences';
import { getActiveOrgId } from '@/lib/org/context';

type PatchBody = Partial<{
  criticalAlerts: boolean;
  weeklyDigest: boolean;
  monthlyReport: boolean;
  allClearUpdates: boolean;
  /** @deprecated */
  vulnerabilityAlerts: boolean;
  /** @deprecated */
  criticalThreats: boolean;
}>;

function normalizePatch(body: PatchBody): Partial<NotificationPreferences> {
  const patch: Partial<NotificationPreferences> = {};
  if (typeof body.criticalAlerts === 'boolean') patch.criticalAlerts = body.criticalAlerts;
  if (typeof body.weeklyDigest === 'boolean') patch.weeklyDigest = body.weeklyDigest;
  if (typeof body.monthlyReport === 'boolean') patch.monthlyReport = body.monthlyReport;
  if (typeof body.allClearUpdates === 'boolean') patch.allClearUpdates = body.allClearUpdates;
  if (typeof body.criticalThreats === 'boolean') patch.criticalAlerts = body.criticalThreats;
  if (typeof body.vulnerabilityAlerts === 'boolean' && patch.criticalAlerts === undefined) {
    patch.criticalAlerts = body.vulnerabilityAlerts;
  }
  return patch;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgId = await getActiveOrgId(user.id);
  const preferences = await getNotificationPreferences(user.id, orgId);
  return NextResponse.json(preferences);
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const patch = normalizePatch(body);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid preference fields provided' }, { status: 400 });
  }

  try {
    const orgId = await getActiveOrgId(user.id);
    const preferences = await updateNotificationPreferences(user.id, patch, orgId);
    return NextResponse.json({ ok: true, preferences });
  } catch (err) {
    console.error('[notification-preferences] PATCH failed', err);
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
  }
}
