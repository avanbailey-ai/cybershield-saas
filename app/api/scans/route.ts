import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireDashboardAccess } from '@/lib/auth/requireDashboardAccess'

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await requireDashboardAccess(user)
  if (!access.allowed) return access.response

  const limitParam = parseInt(req.nextUrl.searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);
  const offsetParam = parseInt(req.nextUrl.searchParams.get('offset') ?? '0', 10);
  const limit = Math.min(Math.max(1, limitParam || DEFAULT_LIMIT), MAX_LIMIT);
  const offset = Math.max(0, offsetParam || 0);

  const { data: scans, error, count } = await supabase
    .from('scans')
    .select(`
      id, website_id, started_at, completed_at, security_score, ssl_valid, status, error_message,
      websites(url, label),
      vulnerabilities(id, severity)
    `, { count: 'exact' })
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    scans: scans ?? [],
    pagination: { limit, offset, total: count ?? 0 },
  })
}
