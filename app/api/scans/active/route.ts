/**
 * GET /api/scans/active — dashboard SSOT for scan status (scans table, not scan_queue).
 */

import { createClient } from '@/lib/supabase/server';
import { requireDashboardAccess } from '@/lib/auth/requireDashboardAccess';
import { logApiTiming } from '@/lib/observability/log';
import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

export async function GET(req: NextRequest) {
  const start = Date.now();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireDashboardAccess(user);
  if (!access.allowed) return access.response;

  const limitParam = parseInt(req.nextUrl.searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);
  const limit = Math.min(Math.max(1, limitParam || DEFAULT_LIMIT), MAX_LIMIT);

  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: scans, error } = await supabase
    .from('scans')
    .select(
      'id, website_id, user_id, status, security_score, risk_level, error_message, started_at, completed_at',
    )
    .eq('user_id', user.id)
    .gte('started_at', since)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logApiTiming('/api/scans/active', Date.now() - start, 200, { count: scans?.length ?? 0 });

  return NextResponse.json({ scans: scans ?? [] });
}
