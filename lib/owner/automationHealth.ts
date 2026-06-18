import { createAdminClient } from '@/lib/supabase/admin';

export type AutomationHealthStatus = 'healthy' | 'warning' | 'broken';

export interface AutomationHealthCheck {
  id: string;
  label: string;
  status: AutomationHealthStatus;
  detail: string;
  fixRecommendation: string | null;
  lastCheckedAt: string;
}

export interface AutomationHealthSummary {
  generatedAt: string;
  overall: AutomationHealthStatus;
  checks: AutomationHealthCheck[];
}

function statusRank(s: AutomationHealthStatus): number {
  if (s === 'broken') return 2;
  if (s === 'warning') return 1;
  return 0;
}

function overallStatus(checks: AutomationHealthCheck[]): AutomationHealthStatus {
  if (checks.some((c) => c.status === 'broken')) return 'broken';
  if (checks.some((c) => c.status === 'warning')) return 'warning';
  return 'healthy';
}

export async function getAutomationHealth(): Promise<AutomationHealthSummary> {
  const admin = createAdminClient();
  const now = new Date();
  const generatedAt = now.toISOString();
  const dayAgo = new Date(now.getTime() - 86400000).toISOString();
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400000).toISOString();

  const checks: AutomationHealthCheck[] = [];

  const [
    lastDiscoveryRes,
    pendingScansRes,
    failedSendsRes,
    dueFollowUpsRes,
    supabasePing,
  ] = await Promise.all([
    admin
      .from('owner_discovery_runs')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('owner_prospects')
      .select('id', { count: 'exact', head: true })
      .eq('scan_status', 'pending')
      .is('deleted_at', null),
    admin
      .from('owner_outreach_drafts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .is('deleted_at', null),
    admin
      .from('owner_follow_ups')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'due'),
    admin.from('profiles').select('id', { count: 'exact', head: true }).limit(1),
  ]);

  const lastDiscovery = lastDiscoveryRes.data?.created_at as string | undefined;
  if (!lastDiscovery) {
    checks.push({
      id: 'discovery_cron',
      label: 'Prospect discovery',
      status: 'warning',
      detail: 'No discovery runs recorded yet.',
      fixRecommendation: 'Run discovery manually from Prospects or verify Vercel cron /api/cron/prospect-discovery.',
      lastCheckedAt: generatedAt,
    });
  } else if (lastDiscovery < threeDaysAgo) {
    checks.push({
      id: 'discovery_cron',
      label: 'Prospect discovery',
      status: 'warning',
      detail: `Last run ${new Date(lastDiscovery).toLocaleString()} (>3 days ago).`,
      fixRecommendation: 'Check Vercel cron schedule for prospect-discovery and CRON_SECRET authorization.',
      lastCheckedAt: generatedAt,
    });
  } else {
    checks.push({
      id: 'discovery_cron',
      label: 'Prospect discovery',
      status: 'healthy',
      detail: `Last run ${new Date(lastDiscovery).toLocaleString()}.`,
      fixRecommendation: null,
      lastCheckedAt: generatedAt,
    });
  }

  const pendingScans = pendingScansRes.count ?? 0;
  checks.push({
    id: 'scan_queue',
    label: 'Scan queue',
    status: pendingScans > 25 ? 'warning' : 'healthy',
    detail:
      pendingScans === 0
        ? 'No prospects waiting for scan.'
        : `${pendingScans} prospect(s) pending scan.`,
    fixRecommendation:
      pendingScans > 25
        ? 'Run discovery with auto-scan or trigger scans from Prospects pipeline.'
        : null,
    lastCheckedAt: generatedAt,
  });

  const resendKey = process.env.RESEND_API_KEY?.trim();
  const emailFrom = process.env.EMAIL_FROM?.trim();
  if (!resendKey || !emailFrom) {
    checks.push({
      id: 'resend',
      label: 'Resend delivery',
      status: 'broken',
      detail: !resendKey ? 'RESEND_API_KEY missing.' : 'EMAIL_FROM missing.',
      fixRecommendation: 'Set RESEND_API_KEY and EMAIL_FROM in Vercel environment variables.',
      lastCheckedAt: generatedAt,
    });
  } else {
    const { count: sent24h } = await admin
      .from('owner_outreach_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'email_sent')
      .gte('created_at', dayAgo);
    const failed = failedSendsRes.count ?? 0;
    checks.push({
      id: 'resend',
      label: 'Resend delivery',
      status: failed > 0 ? 'warning' : 'healthy',
      detail: `${sent24h ?? 0} sent (24h) · ${failed} failed draft(s).`,
      fixRecommendation:
        failed > 0
          ? 'Review failed sends in Inbox and retry after verifying domain in Resend.'
          : null,
      lastCheckedAt: generatedAt,
    });
  }

  const dueFollowUps = dueFollowUpsRes.count ?? 0;
  checks.push({
    id: 'follow_ups',
    label: 'Follow-up worker',
    status: dueFollowUps > 10 ? 'warning' : 'healthy',
    detail:
      dueFollowUps === 0
        ? 'No follow-ups currently due.'
        : `${dueFollowUps} follow-up(s) due for approval.`,
    fixRecommendation:
      dueFollowUps > 0
        ? 'Approve follow-ups in Founder Inbox — cron marks due items via markDueFollowUps.'
        : null,
    lastCheckedAt: generatedAt,
  });

  const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();
  const stripeWebhook = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  checks.push({
    id: 'stripe_webhooks',
    label: 'Stripe webhooks',
    status: !stripeSecret || !stripeWebhook ? 'warning' : 'healthy',
    detail:
      !stripeSecret || !stripeWebhook
        ? 'Stripe env vars incomplete — billing events may not sync.'
        : 'Stripe keys configured.',
    fixRecommendation:
      !stripeWebhook
        ? 'Set STRIPE_WEBHOOK_SECRET and verify /api/stripe/webhook in Stripe dashboard.'
        : null,
    lastCheckedAt: generatedAt,
  });

  if (supabasePing.error) {
    checks.push({
      id: 'supabase',
      label: 'Supabase',
      status: 'broken',
      detail: supabasePing.error.message,
      fixRecommendation: 'Verify SUPABASE_SERVICE_ROLE_KEY and project URL.',
      lastCheckedAt: generatedAt,
    });
  } else {
    checks.push({
      id: 'supabase',
      label: 'Supabase',
      status: 'healthy',
      detail: 'Database reachable.',
      fixRecommendation: null,
      lastCheckedAt: generatedAt,
    });
  }

  const cronSecret = process.env.CRON_SECRET?.trim();
  checks.push({
    id: 'vercel_cron',
    label: 'Vercel cron auth',
    status: cronSecret ? 'healthy' : 'warning',
    detail: cronSecret ? 'CRON_SECRET configured.' : 'CRON_SECRET not set.',
    fixRecommendation: cronSecret
      ? null
      : 'Set CRON_SECRET for /api/cron/* worker authorization.',
    lastCheckedAt: generatedAt,
  });

  return {
    generatedAt,
    overall: overallStatus(checks),
    checks: checks.sort((a, b) => statusRank(b.status) - statusRank(a.status)),
  };
}
