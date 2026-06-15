import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireDashboardAccess } from '@/lib/auth/requireDashboardAccess';
import { getActiveOrgId } from '@/lib/org/context';
import { getSecurityTrend } from '@/lib/analytics/securityTrends';

const VALID_PERIODS = new Set([7, 30, 90]);

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await requireDashboardAccess(user);
  if (!access.allowed) return access.response;

  const websiteId = req.nextUrl.searchParams.get('websiteId');
  if (!websiteId) {
    return NextResponse.json({ error: 'websiteId is required' }, { status: 400 });
  }

  const periodParam = parseInt(req.nextUrl.searchParams.get('period') ?? '30', 10);
  const periodDays = VALID_PERIODS.has(periodParam) ? (periodParam as 7 | 30 | 90) : 30;

  const orgId = await getActiveOrgId(user.id);

  const { data: website } = await supabase
    .from('websites')
    .select('id, user_id, org_id')
    .eq('id', websiteId)
    .maybeSingle();

  if (!website) {
    return NextResponse.json({ error: 'Website not found' }, { status: 404 });
  }

  const canAccess =
    website.user_id === user.id || (orgId !== null && website.org_id === orgId);

  if (!canAccess) {
    return NextResponse.json({ error: 'Website not found' }, { status: 404 });
  }

  try {
    const trend = await getSecurityTrend(supabase, websiteId, { days: periodDays });

    return NextResponse.json(trend, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load security trend';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
