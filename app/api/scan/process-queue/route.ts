// POST /api/scan/process-queue
// Processes up to 5 pending jobs from the scan queue
// Safe to call manually; designed for future cron integration

import { createClient } from '@/lib/supabase/server';
import { processQueue } from '@/lib/scanner/processQueue';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await processQueue(5);
  return Response.json(result);
}
