import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { createAdminClient } from '@/lib/supabase/admin';
import { reconcileProspectPipeline } from '@/lib/owner/reconcilePipeline';

export const dynamic = 'force-dynamic';

/** Re-scan contact info and recompute pipeline states for active prospects. */
export async function POST() {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const admin = createAdminClient();
  const result = await reconcileProspectPipeline(admin);

  const { data: prospects } = await admin
    .from('owner_prospects')
    .select('*')
    .is('deleted_at', null)
    .order('opportunity_score', { ascending: false, nullsFirst: false })
    .limit(500);

  return NextResponse.json({
    ok: true,
    ...result,
    prospects: prospects ?? [],
  });
}
