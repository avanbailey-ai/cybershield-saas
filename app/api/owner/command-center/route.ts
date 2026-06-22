import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { getFounderCommandCenter } from '@/lib/owner/founderCommandCenter';

export async function GET() {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const data = await getFounderCommandCenter();
  return NextResponse.json({ ok: true, data });
}
