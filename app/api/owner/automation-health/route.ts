import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { getAutomationHealth } from '@/lib/owner/automationHealth';

export async function GET() {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const health = await getAutomationHealth();
  return NextResponse.json({ ok: true, ...health });
}
