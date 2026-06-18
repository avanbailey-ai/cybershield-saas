import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { createAdminClient } from '@/lib/supabase/admin';
import { hygieneUpdates } from '@/lib/owner/hygiene';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const { id } = await params;
  const body = await req.json();
  const admin = createAdminClient();

  const hygiene = hygieneUpdates(body);
  if (hygiene) {
    const { data, error } = await admin
      .from('owner_competitors')
      .update(hygiene)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, competitor: data });
  }

  const fields = [
    'name',
    'website',
    'pricing_notes',
    'features',
    'positioning',
    'advantages',
    'gaps',
    'opportunities',
    'last_reviewed_at',
    'changes_notes',
  ] as const;
  const updates: Record<string, unknown> = {};
  for (const f of fields) {
    if (body[f] !== undefined) updates[f] = body[f];
  }

  const { data, error } = await admin
    .from('owner_competitors')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, competitor: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const { id } = await params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('owner_competitors')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, competitor: data });
}
