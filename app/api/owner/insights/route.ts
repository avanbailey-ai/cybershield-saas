import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { getBusinessOverview } from '@/lib/owner/metrics';
import { generateMarketingInsights } from '@/lib/owner/generators/insights';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  try {
    const admin = createAdminClient();
    const [overview, hotRes, churnRes, postsRes] = await Promise.all([
      getBusinessOverview('30d'),
      admin
        .from('owner_prospects')
        .select('id', { count: 'exact', head: true })
        .eq('lead_score', 'HOT'),
      admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gt('churn_risk_score', 70),
      admin.from('owner_content_posts').select('id', { count: 'exact', head: true }),
    ]);

    const insights = generateMarketingInsights(overview, {
      hotProspects: hotRes.count ?? 0,
      churnRisk: churnRes.count ?? 0,
      contentPosts: postsRes.count ?? 0,
    });

    return NextResponse.json({ ok: true, insights });
  } catch (err) {
    console.error('[owner/insights]', err);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}
