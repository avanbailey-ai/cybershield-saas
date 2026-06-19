import { promises as dns } from 'dns';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkEmailDnsHealth, type DnsRecordCheck } from '@/lib/email/dnsHealth';
import {
  EMAIL_LINKS_DOMAIN,
  EMAIL_SENDING_DOMAIN,
  EMAIL_TRACK_DOMAIN,
  getResendFromAddress,
  isResendSandboxFrom,
} from '@/lib/email/config';

export type EmailHealthStatus = 'healthy' | 'warning' | 'critical';

export interface EmailHealthCheck {
  id: string;
  label: string;
  status: EmailHealthStatus;
  detail: string;
  fixRecommendation: string | null;
}

export interface EmailHealthSummary {
  generatedAt: string;
  overall: EmailHealthStatus;
  sendingDomain: string;
  checks: EmailHealthCheck[];
}

function mapDnsStatus(s: DnsRecordCheck['status']): EmailHealthStatus {
  if (s === 'broken') return 'critical';
  if (s === 'warning') return 'warning';
  return 'healthy';
}

function overall(checks: EmailHealthCheck[]): EmailHealthStatus {
  if (checks.some((c) => c.status === 'critical')) return 'critical';
  if (checks.some((c) => c.status === 'warning')) return 'warning';
  return 'healthy';
}

export async function getEmailHealth(): Promise<EmailHealthSummary> {
  const generatedAt = new Date().toISOString();
  const checks: EmailHealthCheck[] = [];

  const dnsChecks = await checkEmailDnsHealth();
  for (const d of dnsChecks) {
    checks.push({
      id: d.id,
      label: d.label,
      status: mapDnsStatus(d.status),
      detail: d.detail,
      fixRecommendation: d.fixRecommendation,
    });
  }

  const from = getResendFromAddress('outreach');
  if (isResendSandboxFrom(from)) {
    checks.push({
      id: 'resend_domain',
      label: 'Resend sending domain',
      status: 'critical',
      detail: 'Using Resend sandbox — customer delivery blocked',
      fixRecommendation: `Verify ${EMAIL_SENDING_DOMAIN} in Resend and set EMAIL_FROM=CyberShield <outreach@${EMAIL_SENDING_DOMAIN}>`,
    });
  } else if (!from.includes(EMAIL_SENDING_DOMAIN)) {
    checks.push({
      id: 'resend_domain',
      label: 'Resend sending domain',
      status: 'warning',
      detail: `Sender ${from} is not on mail subdomain`,
      fixRecommendation: `Migrate to outreach@${EMAIL_SENDING_DOMAIN} for reputation isolation`,
    });
  } else {
    checks.push({
      id: 'resend_domain',
      label: 'Resend sending domain',
      status: process.env.RESEND_API_KEY ? 'healthy' : 'critical',
      detail: process.env.RESEND_API_KEY
        ? `Sending from ${from}`
        : 'RESEND_API_KEY not configured',
      fixRecommendation: process.env.RESEND_API_KEY
        ? null
        : 'Set RESEND_API_KEY in Vercel environment variables.',
    });
  }

  if (process.env.EMAIL_USE_CUSTOM_TRACKING !== 'true') {
    checks.push({
      id: 'custom_tracking',
      label: 'Custom tracking domains',
      status: 'warning',
      detail: `Using app URLs for links/opens. Configure ${EMAIL_LINKS_DOMAIN} and ${EMAIL_TRACK_DOMAIN}`,
      fixRecommendation:
        'CNAME links + track subdomains, then set EMAIL_USE_CUSTOM_TRACKING=true in Vercel.',
    });
  }

  const admin = createAdminClient();
  const dayAgo = new Date(Date.now() - 86400000).toISOString();

  const [sentRes, bouncedRes, openedRes, clickedRes] = await Promise.all([
    admin
      .from('owner_email_deliveries')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', dayAgo),
    admin
      .from('owner_email_engagement_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'bounced')
      .gte('created_at', dayAgo),
    admin
      .from('owner_email_engagement_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'opened')
      .gte('created_at', dayAgo),
    admin
      .from('owner_email_engagement_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'clicked')
      .gte('created_at', dayAgo),
  ]);

  const sent = sentRes.count ?? 0;
  const bounced = bouncedRes.count ?? 0;
  const opened = openedRes.count ?? 0;
  const clicked = clickedRes.count ?? 0;
  const bounceRate = sent > 0 ? (bounced / sent) * 100 : 0;
  const openRate = sent > 0 ? (opened / sent) * 100 : 0;
  const clickRate = sent > 0 ? (clicked / sent) * 100 : 0;

  checks.push({
    id: 'delivery_rate',
    label: 'Delivery rate (24h)',
    status: sent === 0 ? 'warning' : bounceRate > 5 ? 'critical' : bounceRate > 2 ? 'warning' : 'healthy',
    detail:
      sent === 0
        ? 'No sends logged in 24h'
        : `${sent} sent · ${bounceRate.toFixed(1)}% bounce · ${openRate.toFixed(1)}% open · ${clickRate.toFixed(1)}% click`,
    fixRecommendation:
      bounceRate > 5
        ? 'High bounce rate — verify contact emails before outreach, check domain reputation.'
        : null,
  });

  return {
    generatedAt,
    overall: overall(checks),
    sendingDomain: EMAIL_SENDING_DOMAIN,
    checks,
  };
}
