import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireDashboardAccess } from '@/lib/auth/requireDashboardAccess';
import { getActiveOrgId } from '@/lib/org/context';
import { requirePermission } from '@/lib/auth/rbac';
import { getSeatLimitForPlan } from '@/lib/billing/orgPlans';
import { auditLog, extractIp } from '@/lib/audit/log';

/** GET /api/org/members — list org members */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireDashboardAccess(user);
  if (!access.allowed) return access.response;

  const orgId = await getActiveOrgId(user.id);
  if (!orgId) return NextResponse.json({ members: [], orgId: null });

  try {
    await requirePermission(user.id, orgId, 'view_scans');
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: members, error } = await admin
    .from('organization_members')
    .select('id, org_id, user_id, role, created_at, profiles(email, full_name)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ orgId, members: members ?? [] });
}

/** POST /api/org/members — invite by email */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireDashboardAccess(user);
  if (!access.allowed) return access.response;

  const orgId = await getActiveOrgId(user.id);
  if (!orgId) return NextResponse.json({ error: 'No organization found' }, { status: 400 });

  try {
    await requirePermission(user.id, orgId, 'manage_users');
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { email, role = 'member' } = body as { email?: string; role?: string };

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  const validRoles = ['admin', 'member', 'viewer'];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: org } = await admin.from('organizations').select('plan, seat_limit').eq('id', orgId).single();
  const seatLimit = org?.seat_limit ?? getSeatLimitForPlan(org?.plan ?? 'free');

  const { count: memberCount } = await admin
    .from('organization_members')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId);

  const { count: inviteCount } = await admin
    .from('org_invites')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gt('expires_at', new Date().toISOString());

  const totalSeats = (memberCount ?? 0) + (inviteCount ?? 0);
  if (seatLimit !== Infinity && totalSeats >= seatLimit) {
    return NextResponse.json(
      { error: 'SEAT_LIMIT_REACHED', message: `Seat limit (${seatLimit}) reached. Upgrade to add more members.` },
      { status: 403 },
    );
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: invite, error } = await admin
    .from('org_invites')
    .upsert(
      {
        org_id: orgId,
        email: email.toLowerCase(),
        role,
        invited_by: user.id,
        expires_at: expiresAt,
      },
      { onConflict: 'org_id,email' },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  auditLog({
    orgId,
    userId: user.id,
    action: 'member_invited',
    metadata: { email, role, inviteId: invite.id },
    ip: extractIp(req),
  });

  // Placeholder: magic link / email invite would be sent here
  return NextResponse.json({ invite, message: 'Invite created (email delivery placeholder)' }, { status: 201 });
}
