import { NextResponse } from 'next/server';
import { isWorkerAuthorized } from '@/lib/queue/workerAuth';
import { createAdminClient } from '@/lib/supabase/admin';
import { runGrowthAutopilot } from '@/lib/owner/growthAutopilot';

export const dynamic = 'force-dynamic';

/** Nightly owner-only growth autopilot — prepare-only by default; CRON_SECRET required. */
export async function POST(request: Request) {
  if (!isWorkerAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const result = await runGrowthAutopilot(admin);

  return NextResponse.json({
    ok: result.ok,
    prepareOnly: result.prepareOnly,
    mode: result.mode,
    deliverabilityPaused: result.deliverabilityPaused,
    overnight: result.overnight,
    blockedReasons: result.blockedReasons,
    discovery: result.discovery,
    scanned: result.scanned,
    draftsCreated: result.draftsCreated,
    followUpsDue: result.followUpsDue,
  });
}

export async function GET(request: Request) {
  return POST(request);
}
