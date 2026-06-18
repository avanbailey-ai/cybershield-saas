import dns from 'node:dns/promises';
import type { DnsRecordsSnapshot } from './types';

const EMPTY_DNS: DnsRecordsSnapshot = { a: [], aaaa: [], cname: [] };

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

/** Resolve A, AAAA, and CNAME records for a hostname. */
export async function probeDns(hostname: string): Promise<DnsRecordsSnapshot> {
  const host = hostname.trim().toLowerCase();
  if (!host) return { ...EMPTY_DNS };

  const records: DnsRecordsSnapshot = { a: [], aaaa: [], cname: [] };

  try {
    records.a = sortedUnique(await dns.resolve4(host));
  } catch {
    // ENODATA / ENOTFOUND — no A records
  }

  try {
    records.aaaa = sortedUnique(await dns.resolve6(host));
  } catch {
    // no AAAA records
  }

  try {
    records.cname = sortedUnique(await dns.resolveCname(host));
  } catch {
    // no CNAME records
  }

  return records;
}

export function dnsRecordsEqual(a: DnsRecordsSnapshot, b: DnsRecordsSnapshot): boolean {
  const join = (r: DnsRecordsSnapshot) =>
    `${r.a.join(',')}|${r.aaaa.join(',')}|${r.cname.join(',')}`;
  return join(a) === join(b);
}

export function formatDnsSummary(records: DnsRecordsSnapshot): string {
  const parts: string[] = [];
  if (records.a.length) parts.push(`A: ${records.a.join(', ')}`);
  if (records.aaaa.length) parts.push(`AAAA: ${records.aaaa.join(', ')}`);
  if (records.cname.length) parts.push(`CNAME: ${records.cname.join(', ')}`);
  return parts.length ? parts.join(' · ') : 'No A/AAAA/CNAME records found';
}
