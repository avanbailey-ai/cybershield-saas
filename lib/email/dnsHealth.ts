import { promises as dns } from 'dns';

export type DnsHealthStatus = 'healthy' | 'warning' | 'broken';

export interface DnsRecordCheck {
  id: string;
  label: string;
  status: DnsHealthStatus;
  detail: string;
  fixRecommendation: string | null;
  recordFound: string | null;
}

const ROOT = 'cybershieldcloud.com';
const SENDING = process.env.EMAIL_SENDING_DOMAIN?.trim() || 'mail.cybershieldcloud.com';
const LINKS = process.env.EMAIL_LINKS_DOMAIN?.trim() || 'links.cybershieldcloud.com';
const TRACK = process.env.EMAIL_TRACK_DOMAIN?.trim() || 'track.cybershieldcloud.com';

async function resolveTxt(host: string): Promise<string[]> {
  try {
    const records = await dns.resolveTxt(host);
    return records.map((r) => r.join(''));
  } catch {
    return [];
  }
}

export async function checkEmailDnsHealth(): Promise<DnsRecordCheck[]> {
  const checks: DnsRecordCheck[] = [];

  const dmarcRecords = await resolveTxt(`_dmarc.${ROOT}`);
  const dmarc = dmarcRecords.find((r) => r.startsWith('v=DMARC1'));
  if (!dmarc) {
    checks.push({
      id: 'dmarc',
      label: 'DMARC',
      status: 'broken',
      detail: 'No DMARC record found at _dmarc.cybershieldcloud.com',
      fixRecommendation:
        'Add TXT _dmarc.cybershieldcloud.com → v=DMARC1; p=none; rua=mailto:dmarc@cybershieldcloud.com',
      recordFound: null,
    });
  } else if (dmarc.includes('p=reject')) {
    checks.push({
      id: 'dmarc',
      label: 'DMARC',
      status: 'healthy',
      detail: 'DMARC active (p=reject)',
      fixRecommendation: null,
      recordFound: dmarc,
    });
  } else if (dmarc.includes('p=quarantine')) {
    checks.push({
      id: 'dmarc',
      label: 'DMARC',
      status: 'healthy',
      detail: 'DMARC quarantine policy active',
      fixRecommendation: 'After 30 days clean reports, upgrade to p=reject.',
      recordFound: dmarc,
    });
  } else {
    checks.push({
      id: 'dmarc',
      label: 'DMARC',
      status: 'warning',
      detail: 'DMARC monitoring (p=none)',
      fixRecommendation: 'Stage 1 complete. After 2–4 weeks, upgrade to p=quarantine.',
      recordFound: dmarc,
    });
  }

  const sendingTxt = await resolveTxt(SENDING);
  const sendingSpf = sendingTxt.find((r) => r.startsWith('v=spf1'));
  const rootTxt = await resolveTxt(ROOT);
  const rootSpf = rootTxt.find((r) => r.startsWith('v=spf1'));
  const spfRecord = sendingSpf ?? rootSpf;

  checks.push({
    id: 'spf',
    label: 'SPF',
    status: spfRecord?.includes('include:') ? 'healthy' : 'warning',
    detail: spfRecord
      ? `SPF on ${sendingSpf ? SENDING : ROOT}`
      : 'SPF not detected',
    fixRecommendation: spfRecord
      ? null
      : `Add SPF on ${SENDING}: v=spf1 include:amazonses.com ~all`,
    recordFound: spfRecord ?? null,
  });

  let dkimFound: string | null = null;
  for (const host of [`resend._domainkey.${SENDING}`, `resend._domainkey.${ROOT}`]) {
    const records = await resolveTxt(host);
    if (records.length > 0) {
      dkimFound = host;
      break;
    }
  }

  checks.push({
    id: 'dkim',
    label: 'DKIM',
    status: dkimFound ? 'healthy' : 'warning',
    detail: dkimFound ? `DKIM at ${dkimFound}` : 'DKIM not found via DNS',
    fixRecommendation: dkimFound ? null : `Verify ${SENDING} in Resend and publish DKIM records.`,
    recordFound: dkimFound,
  });

  for (const [id, domain, label] of [
    ['links_domain', LINKS, 'Click tracking (links)'],
    ['track_domain', TRACK, 'Open tracking (track)'],
  ] as const) {
    try {
      await dns.resolveCname(domain);
      checks.push({
        id,
        label,
        status: 'healthy',
        detail: `${domain} resolves`,
        fixRecommendation: null,
        recordFound: domain,
      });
    } catch {
      checks.push({
        id,
        label,
        status: 'warning',
        detail: `${domain} not configured — app fallback active`,
        fixRecommendation: `CNAME ${domain} → your app host. Set EMAIL_USE_CUSTOM_TRACKING=true.`,
        recordFound: null,
      });
    }
  }

  return checks;
}
