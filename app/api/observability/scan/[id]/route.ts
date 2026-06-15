/**
 * GET /api/observability/scan/[id]
 * Reconstruct scan trace timeline for the authenticated user's own scan.
 */

import { createClient } from '@/lib/supabase/server';
import { reconstructScan } from '@/lib/observability/reconstructScan';
import { getUser } from '@/services/supabaseService';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: scanId } = await params;
  const supabase = await createClient();
  const { user } = await getUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: scan } = await supabase
    .from('scans')
    .select('id, user_id')
    .eq('id', scanId)
    .maybeSingle();

  if (!scan || scan.user_id !== user.id) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
  }

  const reconstruction = await reconstructScan(scanId);
  return NextResponse.json(reconstruction);
}
