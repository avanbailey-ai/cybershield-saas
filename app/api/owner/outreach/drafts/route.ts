import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { createAdminClient } from '@/lib/supabase/admin';
import { hygieneUpdates } from '@/lib/owner/hygiene';

export async function GET(req: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const view = req.nextUrl.searchParams.get('view') ?? 'active';
  const admin = createAdminClient();
  let query = admin.from('owner_outreach_drafts').select('*').is('deleted_at', null);
  if (view === 'archived') query = query.not('archived_at', 'is', null);
  else if (view === 'active') query = query.is('archived_at', null);

  const { data, error } = await query
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, drafts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const body = await req.json();
  const { prospect_id, outreach_type, business_name, content, status } = body;

  if (!content?.trim() || !outreach_type) {
    return NextResponse.json({ error: 'content and outreach_type required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('owner_outreach_drafts')
    .insert({
      prospect_id: prospect_id ?? null,
      outreach_type,
      business_name: business_name ?? null,
      content: content.trim(),
      status: status ?? 'draft',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, draft: data });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const body = await req.json();
  const { id, content, status } = body;

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const hygiene = hygieneUpdates(body);
  if (hygiene) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('owner_outreach_drafts')
      .update(hygiene)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, draft: data });
  }

  const updates: Record<string, unknown> = {};
  if (content !== undefined) updates.content = content;
  if (status !== undefined) updates.status = status;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('owner_outreach_drafts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, draft: data });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const body = await req.json();
  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('owner_outreach_drafts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, draft: data });
}
