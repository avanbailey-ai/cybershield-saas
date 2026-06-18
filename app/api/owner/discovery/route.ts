import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { parseUrlBatch, parseCsvImport } from '@/lib/owner/prospectDiscovery';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const admin = createAdminClient();
  const { data: runs, error } = await admin
    .from('owner_discovery_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, runs: runs ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const body = await req.json();
  const mode = body.mode as 'batch' | 'csv';

  const discovered =
    mode === 'csv'
      ? parseCsvImport(body.csv ?? body.urls ?? '', body.industry)
      : parseUrlBatch(body.urls ?? '', body.industry);

  if (discovered.length === 0) {
    return NextResponse.json({
      ok: false,
      error: 'No valid websites found. Import a CSV or paste URLs (one per line).',
      discovered: 0,
      prospects: [],
    });
  }

  const autoScan = body.autoScan === true;
  const admin = createAdminClient();
  const inserted = [];

  for (const p of discovered) {
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
        pipeline_state: 'new',
        discovery_source: mode === 'csv' ? 'csv' : 'url_batch',
        lead_score: null,
        conversion_likelihood: null,
        estimated_mrr: null,
        estimated_arr: null,
        opportunity_priority: 0,
      })
      .select()
      .single();

    if (!error && data) {
      inserted.push(data);
      if (autoScan) {
        fetch(
          `${process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/owner/prospects/${data.id}/scan`,
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
