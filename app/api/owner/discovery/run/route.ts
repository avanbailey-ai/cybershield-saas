import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { runProspectDiscovery, scanPendingProspects } from '@/lib/owner/discovery/engine';
import type { DiscoverySettings } from '@/lib/owner/discovery/settings';

export async function POST(req: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  let discoveryOverrides: Partial<DiscoverySettings> | undefined;
  try {
    const body = await req.json();
    if (body && typeof body === 'object') {
      discoveryOverrides = body.discovery ?? body;
    }
  } catch {
    /* empty body is fine */
  }

  try {
    const result = await runProspectDiscovery({
      settings: discoveryOverrides,
      autoScan: true,
    });
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
