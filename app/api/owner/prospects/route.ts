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
    .from('owner_prospects')
    .select('*')
    .order('created_at', { ascending: false });

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
  const { business_name, website, industry, city } = body;

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
      scan_status: 'pending',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, prospect: data });
}
