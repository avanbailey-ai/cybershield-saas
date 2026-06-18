import { extractRegistrableDomain, hostnameFromUrl, stripWww } from './extractDomain';
import { probeDns } from './probeDns';
import type { DomainSnapshotInfo } from './types';

const MS_DAY = 24 * 60 * 60 * 1000;
const RDAP_TIMEOUT_MS = 10000;

interface RdapEvent {
  eventAction?: string;
  eventDate?: string;
}

interface RdapEntity {
  roles?: string[];
  vcardArray?: unknown;
}

interface RdapResponse {
  events?: RdapEvent[];
  entities?: RdapEntity[];
}

function parseVcardName(vcardArray: unknown): string | null {
  if (!Array.isArray(vcardArray) || vcardArray.length < 2) return null;
  const props = vcardArray[1];
  if (!Array.isArray(props)) return null;
  for (const prop of props) {
    if (Array.isArray(prop) && prop[0] === 'fn' && typeof prop[3] === 'string') {
      return prop[3];
    }
  }
  return null;
}

function parseRegistrar(entities: RdapEntity[] | undefined): string | null {
  if (!entities?.length) return null;
  for (const entity of entities) {
    if (entity.roles?.includes('registrar')) {
      const name = parseVcardName(entity.vcardArray);
      if (name) return name;
    }
  }
  return null;
}

function parseExpiration(events: RdapEvent[] | undefined): { expiresAt: string; daysUntilExpiry: number } | null {
  if (!events?.length) return null;
  const expiration = events.find((e) => e.eventAction === 'expiration');
  if (!expiration?.eventDate) return null;

  const expiresAt = new Date(expiration.eventDate);
  if (Number.isNaN(expiresAt.getTime())) return null;

  const daysUntilExpiry = Math.ceil((expiresAt.getTime() - Date.now()) / MS_DAY);
  return { expiresAt: expiresAt.toISOString(), daysUntilExpiry };
}

/** RDAP lookup via rdap.org — works on Vercel serverless without WHOIS sockets. */
export async function probeDomainRdap(domain: string): Promise<{
  registrar: string | null;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
}> {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) {
    return { registrar: null, expiresAt: null, daysUntilExpiry: null };
  }

  try {
    const response = await fetch(`https://rdap.org/domain/${encodeURIComponent(normalized)}`, {
      headers: { Accept: 'application/rdap+json' },
      signal: AbortSignal.timeout(RDAP_TIMEOUT_MS),
    });

    if (!response.ok) {
      return { registrar: null, expiresAt: null, daysUntilExpiry: null };
    }

    const data = (await response.json()) as RdapResponse;
    const expiry = parseExpiration(data.events);
    const registrar = parseRegistrar(data.entities);

    return {
      registrar,
      expiresAt: expiry?.expiresAt ?? null,
      daysUntilExpiry: expiry?.daysUntilExpiry ?? null,
    };
  } catch {
    return { registrar: null, expiresAt: null, daysUntilExpiry: null };
  }
}

/** Full domain probe: RDAP expiry/registrar + DNS records for the site hostname. */
export async function probeDomainForUrl(url: string): Promise<DomainSnapshotInfo | null> {
  const hostname = hostnameFromUrl(url);
  const domain = extractRegistrableDomain(url);
  if (!hostname || !domain) return null;

  const dnsHost = stripWww(hostname);
  const [rdap, dnsRecords] = await Promise.all([
    probeDomainRdap(domain),
    probeDns(dnsHost),
  ]);

  return {
    domain,
    hostname: dnsHost,
    registrar: rdap.registrar,
    expiresAt: rdap.expiresAt,
    daysUntilExpiry: rdap.daysUntilExpiry,
    dnsRecords,
  };
}
