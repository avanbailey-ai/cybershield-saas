import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isOwner } from '@/lib/auth/owner';

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isOwner(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 100);

  const admin = createAdminClient();

  const [cronRunsRes, emailLogsRes, emailSummaryRes] = await Promise.all([
    admin
      .from('cron_monitoring_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit),
    admin
      .from('email_alert_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit),
    admin
      .from('email_alert_logs')
      .select('status, email_type, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const last24h = emailSummaryRes.data ?? [];
  const sent24h = last24h.filter((r) => r.status === 'sent').length;
  const skipped24h = last24h.filter((r) => r.status === 'skipped').length;
  const failed24h = last24h.filter((r) => r.status === 'failed').length;

  return NextResponse.json({
    cronRuns: cronRunsRes.data ?? [],
    emailLogs: emailLogsRes.data ?? [],
    summary: {
      emailsLast24h: last24h.length,
      sentLast24h: sent24h,
      skippedLast24h: skipped24h,
      failedLast24h: failed24h,
    },
  });
}
