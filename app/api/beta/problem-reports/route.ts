import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isOwner } from '@/lib/auth/owner';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isOwner(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('beta_problem_reports')
    .select(
      'id, created_at, status, problem_type, severity, message, contact_email, can_contact, page_url, user_id, org_id, plan, website_id, scan_id, report_id, debug_context, resolved_at, admin_notes',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[beta/problem-reports] list failed:', error.message);
    return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 });
  }

  return NextResponse.json({ reports: data ?? [] });
}
