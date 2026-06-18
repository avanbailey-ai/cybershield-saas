export type DomainHealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

export interface DnsRecordsSnapshot {
  a: string[];
  aaaa: string[];
  cname: string[];
}

export interface DomainSnapshotInfo {
  domain: string;
  hostname: string;
  registrar: string | null;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
  dnsRecords: DnsRecordsSnapshot;
}

export interface DomainWebsiteSummary {
  websiteId: string;
  url: string;
  label: string | null;
  status: DomainHealthStatus;
  domain: string | null;
  daysUntilExpiry: number | null;
  expiresAt: string | null;
  registrar: string | null;
  checkedAt: string | null;
}

export const DOMAIN_EXPIRY_THRESHOLDS = [60, 30, 14, 7, 0] as const;

export type DomainExpiryThreshold = (typeof DOMAIN_EXPIRY_THRESHOLDS)[number];
