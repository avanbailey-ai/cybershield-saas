/**
 * GET /api/observability/health
 * Recent metrics summary — auth required or CRON_SECRET (bearer / x-cron-secret).
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isWorkerAuthorized } from '@/lib/queue/workerAuth';
import { getUser } from '@/services/supabaseService';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  if (!isWorkerAuthorized(req)) {
    const supabase = await createClient();
    const { user } = await getUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const admin = createAdminClient();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const [{ count: queueDepth }, { count: failures }, { count: completions }, { data: recentMetrics }] =
    await Promise.all([
      admin
        .from('scan_queue')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'processing']),
      admin
        .from('system_logs')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'scan_failed')
        .gte('created_at', oneHourAgo),
      admin
        .from('system_logs')
        .select('id', { count: 'exact', head: true })
        .in('type', ['scan_completed', 'scan_started'])
        .gte('created_at', oneHourAgo),
      admin
        .from('system_metrics')
        .select('metric_name, metric_value, dimensions, recorded_at')
        .gte('recorded_at', oneHourAgo)
        .order('recorded_at', { ascending: false })
        .limit(50),
    ]);

  const failureRate =
    (completions ?? 0) + (failures ?? 0) > 0
      ? Number(((failures ?? 0) / ((completions ?? 0) + (failures ?? 0))).toFixed(4))
      : 0;

  return NextResponse.json({
    queueDepth: queueDepth ?? 0,
    lastHour: {
      scanFailures: failures ?? 0,
      scanEvents: completions ?? 0,
      failureRate,
    },
    recentMetrics: recentMetrics ?? [],
    generatedAt: new Date().toISOString(),
  });
}
