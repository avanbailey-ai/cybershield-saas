import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireDashboardAccess } from '@/lib/auth/requireDashboardAccess';
import { getActiveOrgId } from '@/lib/org/context';
import { getBenchmarkForWebsite, normalizeWebsiteCategory } from '@/lib/analytics/benchmarking';

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

  const categoryParam = req.nextUrl.searchParams.get('category');
  if (categoryParam && !normalizeWebsiteCategory(categoryParam)) {
    return NextResponse.json(
      { error: 'Invalid category. Use ecommerce, saas, portfolio, or blog.' },
      { status: 400 },
    );
  }

  const orgId = await getActiveOrgId(user.id);

  const { data: website } = await supabase
    .from('websites')
    .select('id, user_id, org_id, url')
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
    const benchmark = await getBenchmarkForWebsite(supabase, websiteId, {
      category: categoryParam,
      websiteUrl: website.url,
    });

    return NextResponse.json(benchmark, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load security benchmark';
    const status = message.includes('No completed scan') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
