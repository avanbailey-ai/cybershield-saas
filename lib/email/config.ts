/** Resend sandbox — only delivers to your Resend account email. */
export const RESEND_SANDBOX_FROM = 'CyberShield <onboarding@resend.dev>';

export const EMAIL_ROOT_DOMAIN = 'cybershieldcloud.com';
export const EMAIL_SENDING_DOMAIN =
  process.env.EMAIL_SENDING_DOMAIN?.trim() || 'mail.cybershieldcloud.com';
export const EMAIL_LINKS_DOMAIN =
  process.env.EMAIL_LINKS_DOMAIN?.trim() || 'links.cybershieldcloud.com';
export const EMAIL_TRACK_DOMAIN =
  process.env.EMAIL_TRACK_DOMAIN?.trim() || 'track.cybershieldcloud.com';

export type EmailCategory =
  | 'outreach'
  | 'follow_up'
  | 'onboarding'
  | 'retention'
  | 'upgrade'
  | 'alert'
  | 'report'
  | 'system';

const FROM_LOCAL: Record<EmailCategory, string> = {
  outreach: 'outreach',
  follow_up: 'outreach',
  onboarding: 'success',
  retention: 'success',
  upgrade: 'success',
  alert: 'alerts',
  report: 'reports',
  system: 'alerts',
};

const REPLY_LOCAL: Record<EmailCategory, string> = {
  outreach: 'outreach',
  follow_up: 'outreach',
  onboarding: 'success',
  retention: 'success',
  upgrade: 'success',
  alert: 'alerts',
  report: 'reports',
  system: 'support',
};

/** DMARC Stage 1 — monitor only. Upgrade to quarantine then reject after 30+ days clean. */
export const DMARC_RECORD_STAGE_1 =
  'v=DMARC1; p=none; rua=mailto:dmarc@cybershieldcloud.com; ruf=mailto:dmarc@cybershieldcloud.com; fo=1';

export function getSendingDomain(): string {
  const from = process.env.EMAIL_FROM?.trim();
  if (from) {
    const match = from.match(/@([a-zA-Z0-9.-]+)/);
    if (match?.[1]) return match[1];
  }
  return EMAIL_SENDING_DOMAIN;
}

export function getResendFromAddress(category: EmailCategory = 'system'): string {
  const override = process.env[`EMAIL_FROM_${category.toUpperCase()}`]?.trim();
  if (override) return override;

  const configured = process.env.EMAIL_FROM?.trim();
  if (configured && !configured.includes('@resend.dev')) {
    if (category === 'system' || category === 'alert') return configured;
  }

  if (process.env.VERCEL_ENV === 'production' || configured) {
    const local = FROM_LOCAL[category];
    return `CyberShield <${local}@${EMAIL_SENDING_DOMAIN}>`;
  }

  return RESEND_SANDBOX_FROM;
}

export function getReplyToAddress(category: EmailCategory = 'system'): string {
  const override = process.env.EMAIL_REPLY_TO?.trim();
  if (override) return override;
  const local = REPLY_LOCAL[category];
  return `${local}@${EMAIL_SENDING_DOMAIN}`;
}

export function isResendSandboxFrom(from?: string): boolean {
  return (from ?? getResendFromAddress()).includes('@resend.dev');
}

export function getTrackingBaseUrl(domain: string, path: string): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://cybershieldcloud.com';
  const useCustomDomain = process.env.EMAIL_USE_CUSTOM_TRACKING === 'true';
  if (useCustomDomain) {
    return `https://${domain}${path}`;
  }
  return `${site}${path}`;
}
