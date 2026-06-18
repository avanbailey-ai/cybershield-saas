import type { SupabaseClient } from '@supabase/supabase-js';
import type { LightweightMonitorMeta } from '@/lib/scanner/runLightweightMonitor';
import { fetchWebsiteChangeTimeline, fetchImportantTimelineEvents } from '@/lib/scanChanges/fetchWebsiteChanges';
import type { GroupedTimelineEvent } from '@/lib/scanChanges/changeTimeline';
import { sslHealthFromDays } from '@/lib/ssl/sslStatus';
import type { SslHealthStatus } from '@/lib/ssl/types';
import { domainHealthFromDays } from '@/lib/domain/domainStatus';
import type { DomainHealthStatus } from '@/lib/domain/types';
import {
  type DomainStatus,
  type UptimeStatus,
  uptimeStatusFromHttp,
} from './healthStatus';

export interface WebsiteHealthAlert {
  id: string;
  title: string;
  message: string;
  severity: string;
  createdAt: string;
  scanId: string | null;
}

export interface WebsiteHealthCenterData {
  website: {
    id: string;
    url: string;
    label: string | null;
    isActive: boolean;
    priorityMonitoring: boolean;
    lastScannedAt: string | null;
    nextScanAt: string | null;
    scanFrequency: string | null;
  };
  security: {
    score: number | null;
    riskLevel: string | null;
    completedAt: string | null;
    scanId: string | null;
  };
  ssl: {
    status: SslHealthStatus;
    daysUntilExpiry: number | null;
    expiresAt: string | null;
    issuer: string | null;
    checkedAt: string | null;
  };
  domain: {
    status: DomainStatus;
    domain: string | null;
    daysUntilExpiry: number | null;
    expiresAt: string | null;
    registrar: string | null;
    checkedAt: string | null;
    message: string;
  };
  uptime: {
    status: UptimeStatus;
    httpStatus: number | null;
    lastCheckedAt: string | null;
    responseTimeMs: number | null;
    scanKind: string | null;
  };
  monitoring: {
    enabled: boolean;
    lastCheckAt: string | null;
    scanKind: string | null;
    priorityMonitoring: boolean;
    scanFrequency: string | null;
  };
  recentChanges: GroupedTimelineEvent[];
  alerts: {
    unreadCount: number;
    recent: WebsiteHealthAlert[];
  };
}

function extractMonitoringMeta(snapshot: unknown): LightweightMonitorMeta | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const meta = (snapshot as { monitoringMeta?: unknown }).monitoringMeta;
  if (!meta || typeof meta !== 'object') return null;
  const m = meta as LightweightMonitorMeta;
  return {
    httpStatus: typeof m.httpStatus === 'number' ? m.httpStatus : null,
    dnsResolved: m.dnsResolved === true,
    dnsAddresses: Array.isArray(m.dnsAddresses) ? m.dnsAddresses : [],
    responseTimeMs: typeof m.responseTimeMs === 'number' ? m.responseTimeMs : 0,
  };
}

export async function fetchWebsiteHealthCenter(
  supabase: SupabaseClient,
  websiteId: string,
): Promise<WebsiteHealthCenterData | null> {
  const { data: website, error: websiteError } = await supabase
    .from('websites')
    .select(
      'id, url, label, is_active, priority_monitoring, last_scanned_at, next_scan_at, scan_frequency',
    )
    .eq('id', websiteId)
    .maybeSingle();

  if (websiteError || !website) return null;

  const [
    latestScanRes,
    sslCertRes,
    domainSnapRes,
    unreadAlertsRes,
    recentUnreadAlertsRes,
    changeTimeline,
  ] = await Promise.all([
    supabase
      .from('scans')
      .select(
        'id, security_score, risk_level, status, completed_at, scan_kind, scan_snapshot, ssl_expiry_days',
      )
      .eq('website_id', websiteId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('ssl_certificates')
      .select('issuer, expires_at, days_until_expiry, checked_at')
      .eq('website_id', websiteId)
      .order('checked_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('domain_snapshots')
      .select('domain, registrar, expires_at, days_until_expiry, checked_at')
      .eq('website_id', websiteId)
      .order('checked_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('alerts')
      .select('id', { count: 'exact', head: true })
      .eq('website_id', websiteId)
      .eq('is_read', false),
    supabase
      .from('alerts')
      .select('id, title, message, severity, created_at, scan_id')
      .eq('website_id', websiteId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(5),
    fetchWebsiteChangeTimeline(supabase, websiteId, 'month'),
  ]);

  const latestScan = latestScanRes.data;
  const sslCert = sslCertRes.data;
  const domainSnap = domainSnapRes.data;
  const sslDays = sslCert?.days_until_expiry ?? latestScan?.ssl_expiry_days ?? null;
  const sslStatus = sslHealthFromDays(sslDays);

  const domainDays = domainSnap?.days_until_expiry ?? null;
  const domainStatus: DomainHealthStatus = domainHealthFromDays(domainDays);
  const domainMessage =
    domainStatus === 'unknown'
      ? 'Domain registration has not been checked yet. CyberShield runs weekly domain checks automatically.'
      : domainDays !== null && domainDays <= 0
        ? 'Domain registration has expired — renew with your registrar immediately.'
        : domainDays !== null && domainDays <= 60
          ? `Registration expires in ${domainDays} day${domainDays === 1 ? '' : 's'}. Plan renewal to avoid downtime.`
          : 'Domain registration looks healthy.';

  const monitoringMeta = extractMonitoringMeta(latestScan?.scan_snapshot);
  const hasHttpCheck = monitoringMeta?.httpStatus != null;
  const uptimeStatus = hasHttpCheck
    ? uptimeStatusFromHttp(monitoringMeta!.httpStatus)
    : latestScan?.scan_kind === 'monitoring_check' || latestScan
      ? ('pending' as UptimeStatus)
      : ('pending' as UptimeStatus);

  const recentChanges =
    changeTimeline != null ? fetchImportantTimelineEvents(changeTimeline, 5) : [];

  const recentAlerts: WebsiteHealthAlert[] = (recentUnreadAlertsRes.data ?? []).map((a) => ({
    id: a.id,
    title: a.title,
    message: a.message,
    severity: a.severity,
    createdAt: a.created_at,
    scanId: a.scan_id,
  }));

  return {
    website: {
      id: website.id,
      url: website.url,
      label: website.label,
      isActive: website.is_active === true,
      priorityMonitoring: website.priority_monitoring === true,
      lastScannedAt: website.last_scanned_at,
      nextScanAt: website.next_scan_at,
      scanFrequency: website.scan_frequency,
    },
    security: {
      score: latestScan?.security_score ?? null,
      riskLevel: latestScan?.risk_level ?? null,
      completedAt: latestScan?.completed_at ?? null,
      scanId: latestScan?.id ?? null,
    },
    ssl: {
      status: sslStatus,
      daysUntilExpiry: sslDays,
      expiresAt: sslCert?.expires_at ?? null,
      issuer: sslCert?.issuer ?? null,
      checkedAt: sslCert?.checked_at ?? null,
    },
    domain: {
      status: domainStatus,
      domain: domainSnap?.domain ?? null,
      daysUntilExpiry: domainDays,
      expiresAt: domainSnap?.expires_at ?? null,
      registrar: domainSnap?.registrar ?? null,
      checkedAt: domainSnap?.checked_at ?? null,
      message: domainMessage,
    },
    uptime: {
      status: uptimeStatus,
      httpStatus: monitoringMeta?.httpStatus ?? null,
      lastCheckedAt: latestScan?.completed_at ?? null,
      responseTimeMs: monitoringMeta?.responseTimeMs ?? null,
      scanKind: latestScan?.scan_kind ?? null,
    },
    monitoring: {
      enabled: website.is_active === true,
      lastCheckAt: latestScan?.completed_at ?? website.last_scanned_at,
      scanKind: latestScan?.scan_kind ?? null,
      priorityMonitoring: website.priority_monitoring === true,
      scanFrequency: website.scan_frequency,
    },
    recentChanges,
    alerts: {
      unreadCount: unreadAlertsRes.count ?? recentAlerts.length,
      recent: recentAlerts,
    },
  };
}
