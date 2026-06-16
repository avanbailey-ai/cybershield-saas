import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isOwner } from '@/lib/auth/owner';
import type { ReportStatus } from '@/lib/beta/problemReports';

export const runtime = 'nodejs';

const VALID_STATUSES: ReportStatus[] = ['new', 'reviewed', 'resolved'];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isOwner(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { status?: string; adminNotes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status as ReportStatus)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    updates.status = body.status;
    if (body.status === 'resolved') {
      updates.resolved_at = new Date().toISOString();
    }
  }

  if (body.adminNotes !== undefined) {
    updates.admin_notes =
      typeof body.adminNotes === 'string' ? body.adminNotes.trim().slice(0, 5000) : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('beta_problem_reports')
    .update(updates)
    .eq('id', id)
    .select('id, status, admin_notes, resolved_at')
    .single();

  if (error) {
    console.error('[beta/problem-reports] update failed:', error.message);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  return NextResponse.json({ report: data });
}
