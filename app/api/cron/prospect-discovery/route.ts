import { NextResponse } from 'next/server';
import { isWorkerAuthorized } from '@/lib/queue/workerAuth';
import { runProspectDiscovery, scanPendingProspects } from '@/lib/owner/discovery/engine';
import { runAutoArchive } from '@/lib/owner/autoArchive';
import { runStaleDataHygiene } from '@/lib/owner/staleDataHygiene';
import { markDueFollowUps } from '@/lib/owner/followUpScheduler';
import { reconcilePaidConversions } from '@/lib/owner/prospectAttribution';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/** Nightly prospect discovery + auto-scan + optional auto-archive */
export async function POST(request: Request) {
  if (!isWorkerAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const discovery = await runProspectDiscovery({ autoScan: true });
  const extraScanned = await scanPendingProspects(10);
  const admin = createAdminClient();
  const archived = await runAutoArchive(admin);
  const hygiene = await runStaleDataHygiene(admin);
  const followUpsDue = await markDueFollowUps(admin);
  const conversions = await reconcilePaidConversions(admin);

  return NextResponse.json({
    ok: true,
    discovery: { ...discovery, scanned: discovery.scanned + extraScanned },
    archived,
    hygiene,
    followUpsDue,
    conversions,
  });
}

export async function GET(request: Request) {
  return POST(request);
}
