import {
  softenStoredAlertMessage,
  isChangeBasedAlertType,
} from './alertCopyFromTimeline';
import {
  businessLanguageGroupedAlertTitle,
  softenCustomerAlertMessage,
  softenCustomerAlertTitle,
} from '@/lib/dashboard/customerLanguage';

export interface AlertForGrouping {
  id: string;
  title: string;
  message: string;
  severity: string;
  is_read: boolean;
  created_at: string;
  website_id: string | null;
  scan_id: string | null;
  type?: string | null;
}

export interface GroupedAlertDisplay {
  id: string;
  scanId: string | null;
  title: string;
  message: string;
  severity: string;
  categoryLabel?: string;
  is_read: boolean;
  created_at: string;
  website_id: string | null;
  rawAlerts: AlertForGrouping[];
  expandable: boolean;
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function worstSeverity(alerts: AlertForGrouping[]): string {
  return alerts.reduce((worst, a) => {
    const current = SEVERITY_ORDER[a.severity] ?? 99;
    const best = SEVERITY_ORDER[worst] ?? 99;
    return current < best ? a.severity : worst;
  }, 'low');
}

function inferCategoryFromTitle(title: string): string {
  if (/dns records|domain registration/i.test(title)) return 'DNS & Domain';
  if (/security protection|header/i.test(title)) return 'Security Protection';
  if (/ssl|https/i.test(title)) return 'SSL & HTTPS';
  if (/third.?party|script/i.test(title)) return 'Third-Party Service';
  if (/asset|script/i.test(title)) return 'Website Assets';
  if (/login|form|endpoint/i.test(title)) return 'Login & Forms';
  if (/meta|content/i.test(title)) return 'Page Content';
  return 'Website Change';
}

const CROSS_SCAN_GROUP_TYPES = new Set(['dns_changed']);

function groupKey(alert: AlertForGrouping): string | null {
  if (alert.type && CROSS_SCAN_GROUP_TYPES.has(alert.type) && alert.website_id) {
    return `website:${alert.website_id}:${alert.type}`;
  }
  if (alert.website_id && /dns records changed/i.test(alert.title)) {
    return `website:${alert.website_id}:dns_title`;
  }
  if (!alert.scan_id) return null;
  if (alert.type && isChangeBasedAlertType(alert.type)) {
    return `${alert.scan_id}:changes`;
  }
  if (alert.type) return `${alert.scan_id}:${alert.type}`;
  return `${alert.scan_id}:misc`;
}

/** Group inbox alerts by scan + business category for display (DB rows unchanged). */
export function groupAlertsForDisplay(alerts: AlertForGrouping[]): GroupedAlertDisplay[] {
  const standalone: AlertForGrouping[] = [];
  const buckets = new Map<string, AlertForGrouping[]>();

  for (const alert of alerts) {
    const key = groupKey(alert);
    if (!key) {
      standalone.push(alert);
      continue;
    }
    const list = buckets.get(key) ?? [];
    list.push(alert);
    buckets.set(key, list);
  }

  const grouped: GroupedAlertDisplay[] = [];

  for (const [, bucket] of buckets) {
    if (bucket.length === 1) {
      const alert = bucket[0]!;
      grouped.push({
        id: alert.id,
        scanId: alert.scan_id,
        title: softenCustomerAlertTitle(alert.title),
        message: softenCustomerAlertMessage(softenStoredAlertMessage(alert.message)),
        severity: alert.severity,
        is_read: alert.is_read,
        created_at: alert.created_at,
        website_id: alert.website_id,
        rawAlerts: [alert],
        expandable: false,
      });
      continue;
    }

    const categoryLabel = inferCategoryFromTitle(bucket[0]!.title);
    const worst = worstSeverity(bucket);
    const allRead = bucket.every((a) => a.is_read);
    const latest = bucket.reduce((a, b) =>
      new Date(a.created_at) > new Date(b.created_at) ? a : b,
    );

    const isDnsGroup =
      bucket[0]?.type === 'dns_changed' || /dns records changed/i.test(bucket[0]?.title ?? '');
    const groupedTitle = isDnsGroup
      ? `${softenCustomerAlertTitle(latest.title)} · ${bucket.length} update${bucket.length === 1 ? '' : 's'}`
      : businessLanguageGroupedAlertTitle(categoryLabel, bucket.length);
    const groupedMessage = isDnsGroup && bucket.length > 1
      ? `${softenCustomerAlertMessage(softenStoredAlertMessage(latest.message))} (${bucket.length - 1} earlier DNS update${bucket.length === 2 ? '' : 's'} in history — expand to review.)`
      : softenCustomerAlertMessage(softenStoredAlertMessage(latest.message));

    grouped.push({
      id: `group:${latest.website_id ?? latest.scan_id}:${categoryLabel}`,
      scanId: latest.scan_id,
      title: groupedTitle,
      message: groupedMessage,
      severity: worst,
      categoryLabel,
      is_read: allRead,
      created_at: latest.created_at,
      website_id: latest.website_id,
      rawAlerts: bucket,
      expandable: true,
    });
  }

  for (const alert of standalone) {
    grouped.push({
      id: alert.id,
      scanId: alert.scan_id,
      title: softenCustomerAlertTitle(alert.title),
      message: softenCustomerAlertMessage(softenStoredAlertMessage(alert.message)),
      severity: alert.severity,
      is_read: alert.is_read,
      created_at: alert.created_at,
      website_id: alert.website_id,
      rawAlerts: [alert],
      expandable: false,
    });
  }

  return grouped.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}
