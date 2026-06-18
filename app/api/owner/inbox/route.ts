import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const body = await req.json();
  const { action, ids } = body as { action: 'approve' | 'reject'; ids: string[] };

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 });
  }

  const admin = createAdminClient();
  let approved = 0;

  for (const id of ids) {
    if (id.startsWith('draft-')) {
      const draftId = id.replace('draft-', '');
      const { error } = await admin
        .from('owner_outreach_drafts')
        .update({ status: action === 'approve' ? 'approved' : 'draft' })
        .eq('id', draftId);
      if (!error) approved++;
    }
    // expansion/risk/signup items are review-only — approval acknowledges in UI via refresh
    else if (action === 'approve') {
      approved++;
    }
  }

  return NextResponse.json({ ok: true, approved });
}
