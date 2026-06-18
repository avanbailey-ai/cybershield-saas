import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { runProspectDiscovery, scanPendingProspects } from '@/lib/owner/discovery/engine';

export async function POST() {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  try {
    const result = await runProspectDiscovery({ autoScan: true });
    const extraScanned = await scanPendingProspects(5);
    return NextResponse.json({
      ok: true,
      ...result,
      scanned: result.scanned + extraScanned,
    });
  } catch (err) {
    console.error('[owner/discovery/run]', err);
    return NextResponse.json({ error: 'Discovery failed' }, { status: 500 });
  }
}
