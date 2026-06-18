import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const includeArchived = req.nextUrl.searchParams.get('include_archived') === 'true';

  const admin = createAdminClient();
  let query = admin
    .from('owner_prospects')
    .select('*')
    .is('deleted_at', null)
    .order('opportunity_score', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (!includeArchived) {
    query = query
      .not('pipeline_state', 'eq', 'archived')
      .not('pipeline_state', 'eq', 'ignore_forever');
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, prospects: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const body = await req.json();
  const { business_name, website, industry, city, state, country } = body;

  if (!business_name?.trim() || !website?.trim()) {
    return NextResponse.json({ error: 'business_name and website required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('owner_prospects')
    .insert({
      business_name: business_name.trim(),
      website: website.trim(),
      industry: industry?.trim() || null,
      city: city?.trim() || null,
      state: state?.trim() || null,
      country: country?.trim() || null,
      scan_status: 'pending',
      pipeline_state: 'new_discovery',
      discovery_source: 'manual',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, prospect: data });
}
