import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { generateProspectList, parseUrlBatch } from '@/lib/owner/prospectDiscovery';
import { createAdminClient } from '@/lib/supabase/admin';
import { scoreOpportunity } from '@/lib/owner/opportunityScore';

export async function POST(req: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const body = await req.json();
  const mode = body.mode as 'search' | 'batch';

  let discovered =
    mode === 'batch'
      ? parseUrlBatch(body.urls ?? '', body.industry)
      : generateProspectList({
          industry: body.industry ?? 'healthcare',
          city: body.city,
          state: body.state,
          country: body.country,
          limit: body.limit ?? 8,
        });

  const autoScan = body.autoScan === true;
  const admin = createAdminClient();
  const inserted = [];

  for (const p of discovered) {
    const opp = scoreOpportunity({ industry: p.industry });
    const { data, error } = await admin
      .from('owner_prospects')
      .insert({
        business_name: p.business_name,
        website: p.website,
        industry: p.industry,
        city: p.city,
        state: p.state,
        country: p.country,
        scan_status: 'pending',
        conversion_likelihood: opp.conversionLikelihood,
        estimated_mrr: opp.estimatedMrr,
        estimated_arr: opp.estimatedArr,
        opportunity_priority: opp.priority,
      })
      .select()
      .single();

    if (!error && data) {
      inserted.push(data);
      if (autoScan) {
        fetch(
          `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/owner/prospects/${data.id}/scan`,
          { method: 'POST', headers: { cookie: req.headers.get('cookie') ?? '' } },
        ).catch(() => {});
      }
    }
  }

  return NextResponse.json({
    ok: true,
    discovered: inserted.length,
    prospects: inserted,
    autoScanQueued: autoScan,
  });
}
