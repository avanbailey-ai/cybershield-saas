import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { getFounderOsV5 } from '@/lib/owner/founderOsV5';

export async function GET() {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const data = await getFounderOsV5();
  return NextResponse.json({ ok: true, data });
}
