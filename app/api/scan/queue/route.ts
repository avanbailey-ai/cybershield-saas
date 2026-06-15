/**
 * GET /api/scan/queue — user's scan_queue jobs (dashboard source of truth)
 */

import { createClient } from '@/lib/supabase/server';
import { requireDashboardAccess } from '@/lib/auth/requireDashboardAccess';
import { logApiTiming } from '@/lib/observability/log';
import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

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
  const websiteId = req.nextUrl.searchParams.get('websiteId');
  const statusFilter = req.nextUrl.searchParams.get('status');
  const limit = Math.min(Math.max(1, limitParam || DEFAULT_LIMIT), MAX_LIMIT);

  let query = supabase
    .from('scan_queue')
    .select(
      'id, website_id, user_id, domain, status, result, error, created_at, started_at, completed_at, attempts, source',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (websiteId) query = query.eq('website_id', websiteId);
  if (statusFilter) query = query.eq('status', statusFilter);

  const { data: jobs, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logApiTiming('/api/scan/queue', Date.now() - start, 200, { count: jobs?.length ?? 0 });

  return NextResponse.json({ jobs: jobs ?? [] });
}
