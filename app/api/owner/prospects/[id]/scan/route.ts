import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { createAdminClient } from '@/lib/supabase/admin';
import { applyProspectScan } from '@/lib/owner/prospectScanUpdate';

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

  const { data: prospect, error: fetchErr } = await admin
    .from('owner_prospects')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !prospect) {
    return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
  }

  const result = await applyProspectScan(admin, prospect);
  if (!result.ok || !result.prospect) {
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, prospect: result.prospect });
}
