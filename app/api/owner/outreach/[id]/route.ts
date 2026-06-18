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
  const { content, email_subject, email_body } = body as {
    content?: string;
    email_subject?: string;
    email_body?: string;
  };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (content !== undefined) updates.content = content;
  if (email_subject !== undefined) updates.email_subject = email_subject;
  if (email_body !== undefined) updates.email_body = email_body;

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('owner_outreach_drafts')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, draft: data });
}
