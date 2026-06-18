import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { getCustomerIntelligence } from '@/lib/owner/customerIntelligence';
import { getDataMoatSnapshot } from '@/lib/owner/dataMoat';

export async function GET(req: Request) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get('type');

  try {
    if (type === 'moat') {
      const moat = await getDataMoatSnapshot();
      return NextResponse.json({ ok: true, moat });
    }
    const intelligence = await getCustomerIntelligence();
    return NextResponse.json({ ok: true, intelligence });
  } catch (err) {
    console.error('[owner/intelligence]', err);
    return NextResponse.json({ error: 'Failed to load intelligence' }, { status: 500 });
  }
}
