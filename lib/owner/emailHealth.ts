import { promises as dns } from 'dns';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkEmailDnsHealth, type DnsRecordCheck } from '@/lib/email/dnsHealth';
import {
  computeEmailEngagementRates,
  formatDeliveryEngagementDetail,
} from './emailEngagementMetrics';
import {
  EMAIL_LINKS_DOMAIN,
  EMAIL_ROOT_DOMAIN,
  EMAIL_SENDING_DOMAIN,
  EMAIL_TRACK_DOMAIN,
  getResendFromAddress,
  isMailSubdomainConfigured,
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
  const hasApiKey = Boolean(process.env.RESEND_API_KEY);
  const mailSubdomainConfigured = isMailSubdomainConfigured();
  const onMailSubdomain = from.includes(EMAIL_SENDING_DOMAIN);

  if (isResendSandboxFrom(from)) {
    // EMAIL_FROM missing / unverified — falling back to resend.dev sandbox.
    checks.push({
      id: 'resend_domain',
      label: 'Resend sending domain',
      status: 'critical',
      detail: 'Using Resend sandbox — customer delivery blocked (EMAIL_FROM not set to a verified sender)',
      fixRecommendation: `Set EMAIL_FROM=CyberShield <outreach@${EMAIL_ROOT_DOMAIN}> (root domain is verified in Resend).`,
    });
  } else if (!hasApiKey) {
    checks.push({
      id: 'resend_domain',
      label: 'Resend sending domain',
      status: 'critical',
      detail: 'RESEND_API_KEY not configured',
      fixRecommendation: 'Set RESEND_API_KEY in Vercel environment variables.',
    });
  } else if (mailSubdomainConfigured && !onMailSubdomain) {
    // EMAIL_SENDING_DOMAIN is set but sends resolve to a different domain —
    // the mail subdomain likely isn't verified, so config fell back to root.
    checks.push({
      id: 'resend_domain',
      label: 'Resend sending domain',
      status: 'warning',
      detail: `EMAIL_SENDING_DOMAIN is set to ${EMAIL_SENDING_DOMAIN} but sends resolve to ${from}`,
      fixRecommendation: `Verify ${EMAIL_SENDING_DOMAIN} in Resend, or unset EMAIL_SENDING_DOMAIN to use the verified root sender.`,
    });
  } else {
    // Healthy: either sending on the verified mail subdomain, or using the
    // verified root sender with the mail subdomain intentionally disabled.
    checks.push({
      id: 'resend_domain',
      label: 'Resend sending domain',
      status: 'healthy',
      detail: onMailSubdomain
        ? `Sending from ${from}`
        : `Using verified root sender: ${from}. Mail subdomain is optional and currently disabled.`,
      fixRecommendation: null,
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

  const [sentRes, bouncedRes, openEventsRes, clickEventsRes] = await Promise.all([
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
      .select('delivery_id')
      .eq('event_type', 'opened')
      .gte('created_at', dayAgo),
    admin
      .from('owner_email_engagement_events')
      .select('delivery_id')
      .eq('event_type', 'clicked')
      .gte('created_at', dayAgo),
  ]);

  const sent = sentRes.count ?? 0;
  const bounced = bouncedRes.count ?? 0;
  const rates = computeEmailEngagementRates({
    sent,
    bounced,
    openEvents: openEventsRes.data ?? [],
    clickEvents: clickEventsRes.data ?? [],
  });

  checks.push({
    id: 'delivery_rate',
    label: 'Delivery rate (24h)',
    status:
      sent === 0
        ? 'warning'
        : rates.bounceRate > 5
          ? 'critical'
          : rates.bounceRate > 2
            ? 'warning'
            : 'healthy',
    detail: formatDeliveryEngagementDetail(rates),
    fixRecommendation:
      rates.bounceRate > 5
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
