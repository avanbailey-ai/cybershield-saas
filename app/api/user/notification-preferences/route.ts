import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  rowToNotificationPreferences,
  type NotificationPreferences,
} from '@/lib/notifications/preferences';

type PatchBody = Partial<{
  vulnerabilityAlerts: boolean;
  weeklyDigest: boolean;
  criticalThreats: boolean;
}>;

function toDbPatch(body: PatchBody): Record<string, boolean> {
  const patch: Record<string, boolean> = {};
  if (typeof body.vulnerabilityAlerts === 'boolean') {
    patch.notify_vulnerability_alerts = body.vulnerabilityAlerts;
  }
  if (typeof body.weeklyDigest === 'boolean') {
    patch.notify_weekly_digest = body.weeklyDigest;
  }
  if (typeof body.criticalThreats === 'boolean') {
    patch.notify_critical_threats = body.criticalThreats;
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

  const { data, error } = await supabase
    .from('profiles')
    .select('notify_vulnerability_alerts, notify_weekly_digest, notify_critical_threats')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[notification-preferences] GET failed', error.message);
    return NextResponse.json(DEFAULT_NOTIFICATION_PREFERENCES);
  }

  return NextResponse.json(rowToNotificationPreferences(data));
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

  const patch = toDbPatch(body);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid preference fields provided' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select('notify_vulnerability_alerts, notify_weekly_digest, notify_critical_threats')
    .single();

  if (error) {
    console.error('[notification-preferences] PATCH failed', error.message);
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
  }

  const preferences: NotificationPreferences = rowToNotificationPreferences(data);
  return NextResponse.json({ ok: true, preferences });
}
