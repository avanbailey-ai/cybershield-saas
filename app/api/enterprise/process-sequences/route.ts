import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processEnterpriseEmailSequences } from '@/lib/sales/sequences';

function isAuthorizedByCron(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;

  return authHeader.slice(7) === cronSecret;
}

/**
 * POST /api/enterprise/process-sequences — process due enterprise nurture emails.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorizedByCron(req)) {
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
