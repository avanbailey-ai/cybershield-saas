import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { getCustomerDirectory } from '@/lib/owner/customerDirectory';

export async function GET() {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const directory = await getCustomerDirectory();
  return NextResponse.json({ ok: true, ...directory });
}
