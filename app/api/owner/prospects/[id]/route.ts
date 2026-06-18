import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ProspectPipelineState } from '@/lib/owner/discovery/types';

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
  const updates: Record<string, unknown> = {};

  if (body.archive === true) {
    updates.pipeline_state = 'archived';
    updates.archived_at = new Date().toISOString();
  }
  if (body.unarchive === true) {
    updates.pipeline_state = body.pipeline_state ?? 'new_discovery';
    updates.archived_at = null;
  }
  if (body.ignore_forever === true) {
    updates.pipeline_state = 'ignore_forever';
    updates.archived_at = new Date().toISOString();
  }
  if (body.pipeline_state) {
    updates.pipeline_state = body.pipeline_state as ProspectPipelineState;
    if (body.pipeline_state === 'archived') {
      updates.archived_at = new Date().toISOString();
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updates' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('owner_prospects')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, prospect: data });
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
    .from('owner_prospects')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, prospect: data });
}
