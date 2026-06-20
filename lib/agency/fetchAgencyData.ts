import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgencyClientWebsiteRow } from '@/components/agency/AgencyClientWebsitesView';
import { resolveClientDisplayName, type WebsiteClientContext } from '@/lib/agency/clientContext';
import {
  filterCurrentAlertsByLatestScan,
  latestScanHasCriticalHighFindings,
  type LatestScanForAlertFreshness,
} from '@/lib/agency/scanFreshness';
import { getScoreBand, getWebsiteDisplayName, scoreToHealthCategory } from '@/lib/dashboard/dashboardCommandCenter';
import { formatRelativeScanTime } from '@/lib/websiteHealth/healthCenterCopy';
import { buildEnterpriseWebsiteRows } from '@/lib/enterprise/enterpriseCommandCenter';
import { fetchSslDashboardSummary } from '@/lib/ssl/fetchSslDashboardSummary';
import { fetchDomainDashboardSummary } from '@/lib/domain/fetchDomainDashboardSummary';

type WebsiteRow = WebsiteClientContext & {
  id: string;
  last_scanned_at: string | null;
};

export async function fetchAgencyClientWebsiteRows(
  admin: SupabaseClient,
  orgId: string,
): Promise<AgencyClientWebsiteRow[]> {
  const { data: websites } = await admin
    .from('websites')
    .select(
      'id, url, label, client_group, client_name, client_company, client_contact_name, client_contact_email, client_notes, client_report_frequency, client_status, agency_internal_notes, last_scanned_at',
    )
    .eq('org_id', orgId)
    .eq('is_active', true);

  if (!websites?.length) return [];

  const websiteIds = websites.map((w) => w.id);
  const sinceWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [sslSummary, domainSummary, scansRes, changesRes] = await Promise.all([
    fetchSslDashboardSummary(admin, websiteIds),
    fetchDomainDashboardSummary(admin, websiteIds),
    admin
      .from('scans')
      .select('id, website_id, security_score, completed_at, issues, status')
      .eq('org_id', orgId)
      .eq('status', 'completed')
      .in('website_id', websiteIds)
      .order('completed_at', { ascending: false })
      .limit(websiteIds.length * 3),
    admin
      .from('scan_changes')
      .select('website_id')
      .in('website_id', websiteIds)
      .gte('detected_at', sinceWeek),
  ]);

  const changesByWebsite = new Map<string, number>();
  for (const row of changesRes.data ?? []) {
    changesByWebsite.set(row.website_id, (changesByWebsite.get(row.website_id) ?? 0) + 1);
  }

  const latestScanByWebsite = new Map<string, (typeof scansRes.data extends (infer T)[] | null ? T : never)>();
  for (const scan of scansRes.data ?? []) {
    if (!latestScanByWebsite.has(scan.website_id)) {
      latestScanByWebsite.set(scan.website_id, scan);
    }
  }

  const scanInputs = (websites as WebsiteRow[]).map((w) => {
    const latest = latestScanByWebsite.get(w.id);
    const issues = Array.isArray(latest?.issues) ? (latest.issues as string[]) : [];
    return {
      websiteId: w.id,
      url: w.url,
      label: w.label,
      clientGroup: resolveClientDisplayName(w),
      score: latest?.security_score ?? null,
      scanId: latest?.id ?? null,
      completedAt: latest?.completed_at ?? w.last_scanned_at,
      issues,
    };
  });

  const enterpriseRows = buildEnterpriseWebsiteRows({
    scans: scanInputs,
    sslSummary,
    domainSummary,
    changesByWebsite,
    monitoringLabel: 'Active',
  });

  return (websites as WebsiteRow[]).map((w) => {
    const row = enterpriseRows.find((r) => r.id === w.id);
    const clientName = resolveClientDisplayName(w);
    const score = row?.score ?? null;
    const healthCategory = scoreToHealthCategory(score);
    const openFindings = row?.issueCount ?? 0;
    const reportStatus: AgencyClientWebsiteRow['reportStatus'] =
      row?.scanId && score !== null ? 'ready' : row?.scanId ? 'pending' : 'none';

    return {
      id: w.id,
      clientName,
      clientNameRaw: w.client_name,
      clientCompany: w.client_company,
      clientContactName: w.client_contact_name,
      clientContactEmail: w.client_contact_email,
      clientNotes: w.client_notes,
      clientReportFrequency: w.client_report_frequency,
      agencyInternalNotes: w.agency_internal_notes,
      displayName: getWebsiteDisplayName(w.label, w.url),
      url: w.url,
      score,
      healthCategory,
      lastScanLabel: row?.lastScanLabel ?? 'Not scanned yet',
      recentChangesCount: row?.recentChangesCount ?? 0,
      openFindings,
      reportStatus,
      topIssue: row?.topIssue ?? null,
      scanId: row?.scanId ?? null,
      sslStatus: row?.sslStatus ?? 'unknown',
      clientStatus: w.client_status ?? 'active',
    };
  });
}

export async function fetchLatestScansByWebsite(
  admin: SupabaseClient,
  orgId: string | null,
  websiteIds: string[],
): Promise<Map<string, LatestScanForAlertFreshness>> {
  const latestByWebsite = new Map<string, LatestScanForAlertFreshness>();
  if (websiteIds.length === 0) return latestByWebsite;

  let query = admin
    .from('scans')
    .select('id, website_id, security_score, completed_at, issues, status')
    .eq('status', 'completed')
    .in('website_id', websiteIds)
    .order('completed_at', { ascending: false })
    .limit(websiteIds.length * 3);

  if (orgId) {
    query = query.eq('org_id', orgId);
  }

  const { data: scans } = await query;

  for (const scan of scans ?? []) {
    if (!scan.website_id || latestByWebsite.has(scan.website_id)) continue;
    const issues = Array.isArray(scan.issues) ? (scan.issues as string[]) : [];
    latestByWebsite.set(scan.website_id, {
      scanId: scan.id,
      score: scan.security_score,
      completedAt: scan.completed_at,
      hasCriticalHighFindings: latestScanHasCriticalHighFindings(scan.security_score, issues),
    });
  }

  return latestByWebsite;
}

export async function fetchAgencyAlertGroups(
  admin: SupabaseClient,
  orgId: string,
): Promise<
  Array<{
    websiteId: string;
    clientName: string;
    websiteName: string;
    alerts: Array<{
      id: string;
      title: string;
      message: string | null;
      severity: string;
      createdAt: string;
    }>;
  }>
> {
  const { data: alerts } = await admin
    .from('alerts')
    .select(
      'id, title, message, severity, created_at, website_id, scan_id, websites(url, label, client_name, client_company, client_group)',
    )
    .eq('org_id', orgId)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(50);

  const websiteIds = [
    ...new Set(
      (alerts ?? [])
        .map((alert) => alert.website_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const latestByWebsite = await fetchLatestScansByWebsite(admin, orgId, websiteIds);

  const currentAlerts = filterCurrentAlertsByLatestScan(
    (alerts ?? []).map((alert) => ({
      ...alert,
      createdAt: alert.created_at as string,
      scanId: alert.scan_id as string | null,
      websiteId: alert.website_id as string | null,
    })),
    latestByWebsite,
  );

  type AlertGroup = {
    websiteId: string;
    clientName: string;
    websiteName: string;
    alerts: Array<{
      id: string;
      title: string;
      message: string | null;
      severity: string;
      createdAt: string;
    }>;
  };

  const groups = new Map<string, AlertGroup>();

  for (const alert of currentAlerts) {
    const siteRaw = alert.websites as unknown;
    const site = (Array.isArray(siteRaw) ? siteRaw[0] : siteRaw) as WebsiteClientContext & {
      label: string | null;
    } | null;
    const websiteId = alert.website_id as string;
    if (!websiteId) continue;

    const clientName = site ? resolveClientDisplayName({ ...site, url: site.url ?? '' }) : 'Client';
    const websiteName = getWebsiteDisplayName(site?.label ?? null, site?.url ?? '');

    const existing = groups.get(websiteId) ?? {
      websiteId,
      clientName,
      websiteName,
      alerts: [],
    };

    existing.alerts.push({
      id: alert.id,
      title: alert.title,
      message: alert.message as string | null,
      severity: alert.severity,
      createdAt: alert.created_at,
    });
    groups.set(websiteId, existing);
  }

  return [...groups.values()];
}
