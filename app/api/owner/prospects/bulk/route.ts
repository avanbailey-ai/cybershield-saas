import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateOutreach } from '@/lib/owner/generators/outreach';

export async function POST(req: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const body = await req.json();
  const { action, ids, pipeline_state } = body as {
    action:
      | 'archive'
      | 'ignore_forever'
      | 'delete'
      | 'unarchive'
      | 'set_state'
      | 'generate_outreach'
      | 'mark_contacted'
      | 'mark_customer';
    ids: string[];
    pipeline_state?: string;
  };

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  if (action === 'archive') {
    const { error } = await admin
      .from('owner_prospects')
      .update({ pipeline_state: 'archived', archived_at: now })
      .in('id', ids)
      .is('deleted_at', null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (action === 'ignore_forever') {
    const { error } = await admin
      .from('owner_prospects')
      .update({ pipeline_state: 'ignore_forever', archived_at: now })
      .in('id', ids)
      .is('deleted_at', null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (action === 'mark_contacted') {
    const { error } = await admin
      .from('owner_prospects')
      .update({ pipeline_state: 'contacted' })
      .in('id', ids)
      .is('deleted_at', null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (action === 'mark_customer') {
    const { error } = await admin
      .from('owner_prospects')
      .update({ pipeline_state: 'customer' })
      .in('id', ids)
      .is('deleted_at', null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (action === 'unarchive') {
    const { error } = await admin
      .from('owner_prospects')
      .update({ pipeline_state: pipeline_state ?? 'new_discovery', archived_at: null })
      .in('id', ids)
      .is('deleted_at', null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (action === 'delete') {
    const { error } = await admin
      .from('owner_prospects')
      .update({ deleted_at: now })
      .in('id', ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (action === 'set_state' && pipeline_state) {
    const { error } = await admin
      .from('owner_prospects')
      .update({ pipeline_state })
      .in('id', ids)
      .is('deleted_at', null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (action === 'generate_outreach') {
    const { data: prospects } = await admin
      .from('owner_prospects')
      .select('*')
      .in('id', ids)
      .is('deleted_at', null);

    let created = 0;
    for (const p of prospects ?? []) {
      const findings = p.scan_findings as { issues?: string[] } | null;
      const content = generateOutreach('cold_email', {
        businessName: p.business_name,
        website: p.website,
        industry: p.industry,
        city: p.city,
        scanScore: p.scan_score,
        riskLevel: p.scan_risk_level,
        issues: findings?.issues,
      });
      const { error } = await admin.from('owner_outreach_drafts').insert({
        prospect_id: p.id,
        outreach_type: 'cold_email',
        business_name: p.business_name,
        content,
        status: 'draft',
      });
      if (!error) created++;
    }
    return NextResponse.json({ ok: true, count: created });
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, count: ids.length });
}
