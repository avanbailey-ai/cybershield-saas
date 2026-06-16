import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isWorkerAuthorized } from '@/lib/queue/workerAuth';
import { processEnterpriseEmailSequences } from '@/lib/sales/sequences';

/**
 * POST /api/enterprise/process-sequences — process due enterprise nurture emails.
 * Production path: /api/workers/process-emails (Vercel Cron).
 */
export async function POST(req: NextRequest) {
  if (!isWorkerAuthorized(req)) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const result = await processEnterpriseEmailSequences();
  return NextResponse.json({ ok: true, ...result });
}
