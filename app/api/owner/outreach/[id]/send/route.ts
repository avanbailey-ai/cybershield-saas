import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendApprovedOutreach } from '@/lib/owner/outreachExecution';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const { id } = await params;
  const admin = createAdminClient();
  const result = await sendApprovedOutreach(admin, id, { approved: true });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    messageId: result.messageId,
    recipient: result.recipient,
    subject: result.subject,
  });
}
