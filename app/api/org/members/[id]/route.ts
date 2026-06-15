import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireDashboardAccess } from '@/lib/auth/requireDashboardAccess';
import { getActiveOrgId } from '@/lib/org/context';
import { requirePermission } from '@/lib/auth/rbac';
import { auditLog, extractIp } from '@/lib/audit/log';

/** DELETE /api/org/members/[id] — remove org member (admin+ only) */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id: memberId } = await params;
  const admin = createAdminClient();

  const { data: member } = await admin
    .from('organization_members')
    .select('id, user_id, role, org_id')
    .eq('id', memberId)
    .eq('org_id', orgId)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  if (member.role === 'owner') {
    return NextResponse.json({ error: 'Cannot remove organization owner' }, { status: 400 });
  }

  if (member.user_id === user.id) {
    return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 });
  }

  const { error } = await admin.from('organization_members').delete().eq('id', memberId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  auditLog({
    orgId,
    userId: user.id,
    action: 'member_removed',
    metadata: { removedUserId: member.user_id, memberId },
    ip: extractIp(req),
  });

  return NextResponse.json({ success: true });
}

/** PATCH /api/org/members/[id] — change member role */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id: memberId } = await params;
  const body = await req.json();
  const { role } = body as { role?: string };

  const validRoles = ['admin', 'member', 'viewer'];
  if (!role || !validRoles.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: member } = await admin
    .from('organization_members')
    .select('id, role, user_id')
    .eq('id', memberId)
    .eq('org_id', orgId)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  if (member.role === 'owner') {
    return NextResponse.json({ error: 'Cannot change owner role' }, { status: 400 });
  }

  const { error } = await admin.from('organization_members').update({ role }).eq('id', memberId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  auditLog({
    orgId,
    userId: user.id,
    action: 'member_role_changed',
    metadata: { targetUserId: member.user_id, newRole: role },
    ip: extractIp(req),
  });

  return NextResponse.json({ success: true });
}
