import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { getRevenueOpportunity } from '@/lib/owner/revenueOpportunity';

export async function GET() {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  try {
    const revenue = await getRevenueOpportunity();
    return NextResponse.json({ ok: true, revenue });
  } catch (err) {
    console.error('[owner/revenue]', err);
    return NextResponse.json({ error: 'Failed to load revenue data' }, { status: 500 });
  }
}
