import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { createAdminClient } from '@/lib/supabase/admin';

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

  if (body.taskId !== undefined) {
    const { error } = await admin
      .from('owner_campaign_tasks')
      .update({
        completed: body.completed ?? true,
        completed_at: body.completed ? new Date().toISOString() : null,
      })
      .eq('id', body.taskId)
      .eq('campaign_id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (body.status) {
    await admin.from('owner_campaigns').update({ status: body.status }).eq('id', id);
  }

  const { data } = await admin
    .from('owner_campaigns')
    .select('*, owner_campaign_tasks(*)')
    .eq('id', id)
    .single();

  return NextResponse.json({ ok: true, campaign: data });
}
