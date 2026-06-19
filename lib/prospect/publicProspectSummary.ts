import { createAdminClient } from '@/lib/supabase/admin';
import { isValidAttributionToken } from '@/lib/owner/prospectAttribution';

export interface PublicProspectSummary {
  kind: 'agency' | 'smb';
  businessName: string;
  websiteHost: string;
  checkedAreas: string[];
  findings: string[];
  valueProposition: string;
  ctaPlan: 'agency' | 'pro' | 'growth';
  source: string | null;
  prospectToken: string;
}

const CHECKED_AREAS = [
  'SSL certificate health and HTTPS configuration',
  'Domain and DNS-related signals',
  'Security headers and configuration',
  'Uptime and availability patterns',
  'Unexpected website changes',
] as const;

const JARGON_REPLACEMENTS: [RegExp, string][] = [
  [/content-security-policy/gi, 'content security settings'],
  [/hsts/gi, 'HTTPS hardening'],
  [/x-frame-options/gi, 'clickjacking protection'],
  [/csp/gi, 'content security settings'],
];

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0] ?? url;
  }
}

function plainEnglishIssue(raw: string): string {
  let text = raw.trim();
  for (const [pattern, replacement] of JARGON_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  if (text.length > 120) text = `${text.slice(0, 117)}…`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function sanitizeFindings(issues: unknown, kind: 'agency' | 'smb'): string[] {
  if (!Array.isArray(issues)) {
    return kind === 'agency'
      ? [
          'Client-facing sites benefit from continuous SSL and change monitoring',
          'Security configuration drift is easier to catch with automated checks',
        ]
      : [
          'Continuous monitoring helps catch SSL and security changes early',
          'Automated alerts reduce surprise downtime or certificate issues',
        ];
  }

  const plain = issues
    .filter((i): i is string => typeof i === 'string' && i.trim().length > 0)
    .map(plainEnglishIssue)
    .slice(0, 3);

  if (plain.length === 0) {
    return kind === 'agency'
      ? ['Your portfolio would benefit from proactive client-site monitoring']
      : ['Your site would benefit from continuous security monitoring'];
  }
  return plain;
}

function agencyValueProp(): string {
  return 'CyberShield Cloud helps agencies monitor client websites for SSL issues, domain problems, security setting changes, uptime changes, and unexpected website changes — so you can catch problems before clients notice and deliver better monthly reports.';
}

function smbValueProp(): string {
  return 'CyberShield Cloud monitors your website continuously for SSL expiry, domain issues, security configuration changes, and unexpected changes — with clear alerts and reports when something needs attention.';
}

export async function loadPublicProspectSummary(
  token: string,
): Promise<PublicProspectSummary | null> {
  if (!isValidAttributionToken(token)) return null;

  const admin = createAdminClient();
  const { data: attr } = await admin
    .from('owner_prospect_attributions')
    .select('prospect_id')
    .eq('token', token)
    .maybeSingle();

  if (!attr?.prospect_id) return null;

  const { data: prospect } = await admin
    .from('owner_prospects')
    .select(
      'business_name, website, prospect_kind, scan_findings, agency_why_selected, selection_reason, deleted_at',
    )
    .eq('id', attr.prospect_id as string)
    .maybeSingle();

  if (!prospect || prospect.deleted_at) return null;

  const kind = prospect.prospect_kind === 'agency' ? 'agency' : 'smb';
  const findingsRaw = (prospect.scan_findings as { issues?: unknown } | null)?.issues;
  const findings = sanitizeFindings(findingsRaw, kind);

  const why =
    kind === 'agency'
      ? (prospect.agency_why_selected as string | null)
      : (prospect.selection_reason as string | null);
  if (why && typeof why === 'string' && why.length > 10 && findings.length < 3) {
    const extra = plainEnglishIssue(why);
    if (!findings.includes(extra)) findings.unshift(extra);
    findings.splice(3);
  }

  return {
    kind,
    businessName: (prospect.business_name as string) || 'Your business',
    websiteHost: hostnameFromUrl((prospect.website as string) || ''),
    checkedAreas: [...CHECKED_AREAS],
    findings,
    valueProposition: kind === 'agency' ? agencyValueProp() : smbValueProp(),
    ctaPlan: kind === 'agency' ? 'agency' : 'pro',
    source: kind === 'agency' ? 'agency_outreach' : 'outreach',
    prospectToken: token,
  };
}
