import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { createAdminClient } from '@/lib/supabase/admin';
import { executeInboxApproval, dismissInboxItem } from '@/lib/owner/inboxAutomation';

export async function POST(req: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const body = await req.json();
  const { action, ids, meta } = body as {
    action: 'approve' | 'reject' | 'dismiss';
    ids: string[];
    meta?: Record<string, unknown>;
  };

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 });
  }

  const admin = createAdminClient();
  let approved = 0;
  const results: { id: string; ok: boolean; action?: string; detail?: string }[] = [];

  for (const id of ids) {
    if (action === 'approve') {
      const result = await executeInboxApproval(admin, id, meta);
      results.push({ id, ...result });
      if (result.ok) approved++;
    } else if (action === 'dismiss') {
      const result = await dismissInboxItem(admin, id);
      results.push({ id, ok: result.ok, action: 'dismiss' });
      if (result.ok) approved++;
    } else if (id.startsWith('draft-')) {
      const draftId = id.replace('draft-', '');
      const { error } = await admin
        .from('owner_outreach_drafts')
        .update({ status: 'draft' })
        .eq('id', draftId);
      if (!error) approved++;
    }
  }

  const firstFail = results.find((r) => !r.ok);

  return NextResponse.json({
    ok: results.length === 0 || results.every((r) => r.ok),
    approved,
    results,
    error: firstFail?.detail,
  });
}
