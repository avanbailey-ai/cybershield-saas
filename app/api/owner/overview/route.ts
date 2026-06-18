import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { getOverviewAllWindows } from '@/lib/owner/metrics';

export async function GET() {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  try {
    const windows = await getOverviewAllWindows();
    return NextResponse.json({ ok: true, windows });
  } catch (err) {
    console.error('[owner/overview]', err);
    return NextResponse.json({ error: 'Failed to load overview' }, { status: 500 });
  }
}
