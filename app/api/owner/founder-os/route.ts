import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { getFounderOsV6 } from '@/lib/owner/founderOsV6';

export async function GET() {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const data = await getFounderOsV6();
  return NextResponse.json({ ok: true, data });
}
