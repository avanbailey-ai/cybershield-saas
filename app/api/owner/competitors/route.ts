import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('owner_competitors')
    .select('*')
    .order('name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, competitors: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('owner_competitors')
    .insert({
      name: body.name.trim(),
      website: body.website?.trim() || null,
      pricing_notes: body.pricing_notes?.trim() || null,
      features: body.features?.trim() || null,
      positioning: body.positioning?.trim() || null,
      advantages: body.advantages?.trim() || null,
      gaps: body.gaps?.trim() || null,
      opportunities: body.opportunities?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, competitor: data });
}
