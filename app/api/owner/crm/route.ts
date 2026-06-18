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
    .from('owner_crm_leads')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, leads: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const body = await req.json();
  if (!body.business_name?.trim()) {
    return NextResponse.json({ error: 'business_name required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('owner_crm_leads')
    .insert({
      business_name: body.business_name.trim(),
      website: body.website?.trim() || null,
      industry: body.industry?.trim() || null,
      contact_name: body.contact_name?.trim() || null,
      contact_email: body.contact_email?.trim() || null,
      notes: body.notes?.trim() || null,
      stage: body.stage ?? 'new_lead',
      lead_score: body.lead_score ?? null,
      potential_revenue: body.potential_revenue ?? null,
      last_contact_at: body.last_contact_at ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, lead: data });
}
