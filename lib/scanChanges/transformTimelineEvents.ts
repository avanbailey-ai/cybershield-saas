import type { ChangeTimelineItem } from './changeTimeline';

export type BusinessChangeCategory =
  | 'security_protection_changed'
  | 'website_asset_update'
  | 'new_third_party_service'
  | 'login_or_form_changed'
  | 'ssl_status_changed'
  | 'content_meta_changed'
  | 'monitoring_baseline_established';

export type TimelineFilter = 'important' | 'all' | 'security' | 'website_updates' | 'technical';

export type GroupedSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface GroupedTimelineEvent {
  id: string;
  scanId: string;
  detectedAt: string;
  title: string;
  summary: string;
  recommendation: string;
  severity: GroupedSeverity;
  category: BusinessChangeCategory;
  categoryLabel: string;
  affectedAreas: string[];
  alsoDetected?: string;
  isImportant: boolean;
  technicalDetails: ChangeTimelineItem[];
}

export interface NormalizedScriptUrl {
  normalizedKey: string;
  displayUrl: string;
  domain: string | null;
  isThirdParty: boolean;
  isSameDomain: boolean;
}

export interface TransformTimelineOptions {
  websiteUrl: string;
  /** Scan IDs where no prior completed snapshot existed (baseline scan). */
  baselineScanIds?: Set<string>;
}

const SEVERITY_ORDER: Record<GroupedSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const CATEGORY_LABELS: Record<BusinessChangeCategory, string> = {
  security_protection_changed: 'Security Protection',
  website_asset_update: 'Website Assets',
  new_third_party_service: 'Third-Party Service',
  login_or_form_changed: 'Login & Forms',
  ssl_status_changed: 'SSL & HTTPS',
  content_meta_changed: 'Page Content',
  monitoring_baseline_established: 'Monitoring Baseline',
};

const BASELINE_ADDITIVE_TYPES = new Set([
  'script_added',
  'meta_tag_changed',
  'endpoint_added',
  'security_header_changed',
]);

function websiteHostFromUrl(websiteUrl: string): string {
  try {
    return new URL(websiteUrl).hostname.toLowerCase();
  } catch {
    return websiteUrl.replace(/^https?:\/\//i, '').split('/')[0].toLowerCase();
  }
}

/** Strip query strings, normalize host/path for script comparison. */
export function normalizeScriptUrl(raw: string, websiteUrl: string): NormalizedScriptUrl {
  const websiteHost = websiteHostFromUrl(websiteUrl);
  const trimmed = raw.trim();

  if (trimmed.startsWith('inline:')) {
    const key = trimmed.toLowerCase();
    return {
      normalizedKey: key,
      displayUrl: trimmed,
      domain: null,
      isThirdParty: false,
      isSameDomain: true,
    };
  }

  let urlStr = trimmed;
  if (urlStr.startsWith('//')) urlStr = `https:${urlStr}`;
  else if (urlStr.startsWith('/')) urlStr = `https://${websiteHost}${urlStr}`;
  else if (!/^https?:\/\//i.test(urlStr)) {
    if (/^[\w.-]+\.[\w.-]+(\/|$)/.test(urlStr)) {
      urlStr = `https://${urlStr}`;
    } else {
      urlStr = `https://${websiteHost}/${urlStr.replace(/^\/+/, '')}`;
    }
  }

  try {
    const url = new URL(urlStr);
    const host = url.hostname.toLowerCase();
    let path = url.pathname.toLowerCase();
    if (!path.startsWith('/')) path = `/${path}`;
    path = path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    const normalizedKey = `${host}${path}`;
    const isSameDomain = host === websiteHost || host.endsWith(`.${websiteHost}`);
    return {
      normalizedKey,
      displayUrl: trimmed,
      domain: host,
      isThirdParty: !isSameDomain,
      isSameDomain,
    };
  } catch {
    const pathOnly = trimmed.split('?')[0].toLowerCase();
    const normalizedPath = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
    return {
      normalizedKey: normalizedPath,
      displayUrl: trimmed,
      domain: null,
      isThirdParty: false,
      isSameDomain: true,
    };
  }
}

function scriptUrlFromItem(item: ChangeTimelineItem): string | null {
  const match = item.summary.match(/Script (?:added|removed): (.+)$/i);
  if (match?.[1]) return match[1].trim();
  if (item.after && item.after !== '(not present)' && item.after !== '(removed)') return item.after;
  if (item.before && item.before !== '(not present)' && item.before !== '(removed)') return item.before;
  return null;
}

function headerNameFromItem(item: ChangeTimelineItem): string | null {
  const match = item.summary.match(/Security header (?:removed|added|changed): (.+)$/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function isHeaderRemoved(item: ChangeTimelineItem): boolean {
  return item.summary.toLowerCase().startsWith('security header removed:');
}

function isHeaderAdded(item: ChangeTimelineItem): boolean {
  return item.summary.toLowerCase().startsWith('security header added:');
}

function maxSeverity(items: ChangeTimelineItem[]): GroupedSeverity {
  const order: GroupedSeverity[] = ['low', 'medium', 'high', 'critical'];
  let max = 0;
  for (const item of items) {
    const idx = order.indexOf(item.severity as GroupedSeverity);
    if (idx > max) max = idx;
  }
  return order[max] ?? 'low';
}

function securitySeverity(items: ChangeTimelineItem[]): GroupedSeverity {
  let severity: GroupedSeverity = 'low';
  for (const item of items) {
    const header = headerNameFromItem(item);
    if (header === 'strict-transport-security' && isHeaderRemoved(item)) return 'critical';
    if (header === 'content-security-policy' && isHeaderRemoved(item)) {
      severity = severityRank(severity) < severityRank('high') ? 'high' : severity;
      continue;
    }
    if (header === 'x-frame-options' && isHeaderRemoved(item)) {
      severity = severityRank(severity) < severityRank('high') ? 'high' : severity;
      continue;
    }
    if (isHeaderRemoved(item)) {
      severity = severityRank(severity) < severityRank('medium') ? 'medium' : severity;
      continue;
    }
    if (item.summary.toLowerCase().includes('changed:')) {
      severity = severityRank(severity) < severityRank('medium') ? 'medium' : severity;
    }
  }
  return severity;
}

function severityRank(severity: GroupedSeverity): number {
  return SEVERITY_ORDER[severity];
}

function isImportantEvent(
  category: BusinessChangeCategory,
  severity: GroupedSeverity,
): boolean {
  if (severity === 'critical' || severity === 'high') return true;
  if (category === 'security_protection_changed') return true;
  if (category === 'ssl_status_changed') return true;
  if (category === 'login_or_form_changed') return severity !== 'low';
  if (category === 'new_third_party_service') return true;
  if (category === 'monitoring_baseline_established') return true;
  if (category === 'website_asset_update') return severity !== 'low';
  if (category === 'content_meta_changed') return severity !== 'low';
  return false;
}

function recommendationFor(
  category: BusinessChangeCategory,
  severity: GroupedSeverity,
  items: ChangeTimelineItem[],
): string {
  switch (category) {
    case 'security_protection_changed': {
      const hstsRemoved = items.some(
        (i) =>
          headerNameFromItem(i) === 'strict-transport-security' && isHeaderRemoved(i),
      );
      if (hstsRemoved) {
        return 'Re-enable Strict-Transport-Security immediately. Without HSTS, browsers may connect over HTTP and attackers can intercept traffic.';
      }
      const cspRemoved = items.some(
        (i) => headerNameFromItem(i) === 'content-security-policy' && isHeaderRemoved(i),
      );
      if (cspRemoved) {
        return 'Restore your Content-Security-Policy header to limit which scripts and resources can load on your site.';
      }
      return 'Review security header changes with your developer or hosting provider and restore any protections that were removed unintentionally.';
    }
    case 'ssl_status_changed':
      return severity === 'critical'
        ? 'Restore HTTPS immediately. An insecure site exposes visitor data and erodes trust.'
        : 'Verify SSL/TLS settings with your hosting provider and ensure certificates renew automatically.';
    case 'new_third_party_service':
      return 'Confirm the new external script is from a trusted vendor. Remove unknown third-party scripts and tighten your Content-Security-Policy.';
    case 'login_or_form_changed':
      return 'Review login and form changes to ensure they are expected. Unexpected auth changes can indicate compromise or misconfiguration.';
    case 'website_asset_update':
      return severity === 'low'
        ? 'Routine asset refresh — no action needed unless you did not expect a deployment.'
        : 'Review updated scripts and assets to confirm they match a recent deployment or CMS update.';
    case 'content_meta_changed':
      return 'Check that meta tag changes reflect intentional SEO or branding updates.';
    case 'monitoring_baseline_established':
      return 'CyberShield recorded your site\'s initial snapshot. Future scans will highlight meaningful changes from this baseline.';
    default:
      return 'Review this change and confirm it matches your expected site updates.';
  }
}

interface ScanBucket {
  scanId: string;
  detectedAt: string;
  items: ChangeTimelineItem[];
}

function groupByScan(items: ChangeTimelineItem[]): ScanBucket[] {
  const map = new Map<string, ScanBucket>();
  for (const item of items) {
    const existing = map.get(item.scanId);
    if (existing) {
      existing.items.push(item);
    } else {
      map.set(item.scanId, {
        scanId: item.scanId,
        detectedAt: item.detectedAt,
        items: [item],
      });
    }
  }
  return Array.from(map.values());
}

function isBaselineScan(bucket: ScanBucket, baselineScanIds?: Set<string>): boolean {
  const hasSecurityRemoval = bucket.items.some(
    (i) => i.type === 'security_header_changed' && isHeaderRemoved(i),
  );
  const hasSslChange = bucket.items.some((i) => i.type === 'ssl_changed');
  if (hasSecurityRemoval || hasSslChange) return false;

  if (baselineScanIds?.has(bucket.scanId) && bucket.items.length >= 5) return true;

  if (bucket.items.length < 5) return false;
  const additive = bucket.items.filter((i) => BASELINE_ADDITIVE_TYPES.has(i.type)).length;
  return additive / bucket.items.length >= 0.85;
}

interface ProcessedScripts {
  versionBumps: ChangeTimelineItem[][];
  newThirdParty: ChangeTimelineItem[];
  newSameDomain: ChangeTimelineItem[];
  removedScripts: ChangeTimelineItem[];
  inlineScripts: ChangeTimelineItem[];
}

function processScripts(
  items: ChangeTimelineItem[],
  websiteUrl: string,
): ProcessedScripts {
  const added = new Map<string, ChangeTimelineItem>();
  const removed = new Map<string, ChangeTimelineItem>();
  const result: ProcessedScripts = {
    versionBumps: [],
    newThirdParty: [],
    newSameDomain: [],
    removedScripts: [],
    inlineScripts: [],
  };

  for (const item of items) {
    if (item.type !== 'script_added' && item.type !== 'script_removed') continue;
    const url = scriptUrlFromItem(item);
    if (!url) continue;
    const normalized = normalizeScriptUrl(url, websiteUrl);
    const key = normalized.normalizedKey;
    if (item.type === 'script_added') added.set(key, item);
    else removed.set(key, item);
  }

  for (const [key, addItem] of added) {
    const remItem = removed.get(key);
    if (remItem) {
      result.versionBumps.push([remItem, addItem]);
      removed.delete(key);
    } else {
      const url = scriptUrlFromItem(addItem)!;
      const normalized = normalizeScriptUrl(url, websiteUrl);
      if (normalized.displayUrl.startsWith('inline:')) {
        result.inlineScripts.push(addItem);
      } else if (normalized.isThirdParty) {
        result.newThirdParty.push(addItem);
      } else {
        result.newSameDomain.push(addItem);
      }
    }
  }

  for (const remItem of removed.values()) {
    result.removedScripts.push(remItem);
  }

  return result;
}

function buildSecurityEvent(
  bucket: ScanBucket,
  items: ChangeTimelineItem[],
  alsoDetected?: string,
): GroupedTimelineEvent {
  const severity = securitySeverity(items);
  const hstsRemoved = items.some(
    (i) => headerNameFromItem(i) === 'strict-transport-security' && isHeaderRemoved(i),
  );
  const removedCount = items.filter(isHeaderRemoved).length;
  const title = hstsRemoved
    ? 'Critical security protection removed'
    : removedCount > 0
      ? 'Security protection removed'
      : items.some(isHeaderAdded)
        ? 'Security protection added'
        : 'Security protection changed';

  const headers = items
    .map((i) => headerNameFromItem(i))
    .filter((h): h is string => h !== null);

  return {
    id: `${bucket.scanId}:security`,
    scanId: bucket.scanId,
    detectedAt: bucket.detectedAt,
    title,
    summary:
      removedCount > 0
        ? `${removedCount} security header${removedCount === 1 ? '' : 's'} removed during this scan.`
        : `${items.length} security header change${items.length === 1 ? '' : 's'} detected.`,
    recommendation: recommendationFor('security_protection_changed', severity, items),
    severity,
    category: 'security_protection_changed',
    categoryLabel: CATEGORY_LABELS.security_protection_changed,
    affectedAreas: [...new Set(headers.map((h) => h.replace(/-/g, ' ')))],
    alsoDetected,
    isImportant: true,
    technicalDetails: items,
  };
}

function buildAssetUpdateEvent(
  bucket: ScanBucket,
  technicalDetails: ChangeTimelineItem[],
  severity: GroupedSeverity,
  title?: string,
): GroupedTimelineEvent {
  const count = technicalDetails.length;
  return {
    id: `${bucket.scanId}:assets:${count}`,
    scanId: bucket.scanId,
    detectedAt: bucket.detectedAt,
    title: title ?? 'Website asset update detected',
    summary: `${count} website asset${count === 1 ? '' : 's'} updated (likely cache or version refresh).`,
    recommendation: recommendationFor('website_asset_update', severity, technicalDetails),
    severity,
    category: 'website_asset_update',
    categoryLabel: CATEGORY_LABELS.website_asset_update,
    affectedAreas: ['Scripts & assets'],
    isImportant: isImportantEvent('website_asset_update', severity),
    technicalDetails,
  };
}

function buildThirdPartyEvent(
  bucket: ScanBucket,
  items: ChangeTimelineItem[],
  websiteUrl: string,
): GroupedTimelineEvent {
  const domains = items
    .map((i) => {
      const url = scriptUrlFromItem(i);
      return url ? normalizeScriptUrl(url, websiteUrl).domain : null;
    })
    .filter((d): d is string => d !== null);
  const uniqueDomains = [...new Set(domains)];
  const severity: GroupedSeverity = 'high';

  return {
    id: `${bucket.scanId}:third-party`,
    scanId: bucket.scanId,
    detectedAt: bucket.detectedAt,
    title: 'New third-party service detected',
    summary: `${uniqueDomains.length} new external script domain${uniqueDomains.length === 1 ? '' : 's'} loaded: ${uniqueDomains.slice(0, 3).join(', ')}${uniqueDomains.length > 3 ? '…' : ''}.`,
    recommendation: recommendationFor('new_third_party_service', severity, items),
    severity,
    category: 'new_third_party_service',
    categoryLabel: CATEGORY_LABELS.new_third_party_service,
    affectedAreas: uniqueDomains.slice(0, 5).map((d) => d),
    isImportant: true,
    technicalDetails: items,
  };
}

function processScanBucket(
  bucket: ScanBucket,
  websiteUrl: string,
  baselineScanIds?: Set<string>,
): GroupedTimelineEvent[] {
  if (isBaselineScan(bucket, baselineScanIds)) {
    return [
      {
        id: `${bucket.scanId}:baseline`,
        scanId: bucket.scanId,
        detectedAt: bucket.detectedAt,
        title: 'Monitoring baseline established',
        summary: `CyberShield captured ${bucket.items.length} initial data points for this website. Future scans will highlight meaningful changes.`,
        recommendation: recommendationFor('monitoring_baseline_established', 'low', bucket.items),
        severity: 'low',
        category: 'monitoring_baseline_established',
        categoryLabel: CATEGORY_LABELS.monitoring_baseline_established,
        affectedAreas: ['Full site snapshot'],
        isImportant: true,
        technicalDetails: bucket.items,
      },
    ];
  }

  const events: GroupedTimelineEvent[] = [];
  const consumed = new Set<string>();

  const securityItems = bucket.items.filter((i) => i.type === 'security_header_changed');
  for (const i of securityItems) consumed.add(i.id);

  const sslItems = bucket.items.filter((i) => i.type === 'ssl_changed');
  for (const i of sslItems) consumed.add(i.id);

  const loginItems = bucket.items.filter(
    (i) => i.type === 'login_form_changed' || i.type === 'endpoint_added' || i.type === 'endpoint_removed',
  );
  for (const i of loginItems) consumed.add(i.id);

  const metaItems = bucket.items.filter((i) => i.type === 'meta_tag_changed');
  for (const i of metaItems) consumed.add(i.id);

  const scriptItems = bucket.items.filter(
    (i) => i.type === 'script_added' || i.type === 'script_removed',
  );
  const processed = processScripts(scriptItems, websiteUrl);
  for (const pair of processed.versionBumps) {
    for (const i of pair) consumed.add(i.id);
  }
  for (const i of [
    ...processed.newThirdParty,
    ...processed.newSameDomain,
    ...processed.removedScripts,
    ...processed.inlineScripts,
  ]) {
    consumed.add(i.id);
  }

  const assetDetails: ChangeTimelineItem[] = [
    ...processed.versionBumps.flat(),
    ...processed.newSameDomain,
    ...processed.removedScripts.filter((i) => {
      const url = scriptUrlFromItem(i);
      return url ? normalizeScriptUrl(url, websiteUrl).isSameDomain : true;
    }),
  ];

  const assetCount = assetDetails.length;
  const assetAlsoDetected =
    assetCount > 0 && securityItems.length > 0
      ? `Also detected: ${assetCount} website asset change${assetCount === 1 ? '' : 's'}`
      : undefined;

  if (securityItems.length > 0) {
    events.push(buildSecurityEvent(bucket, securityItems, assetAlsoDetected));
  }

  if (sslItems.length > 0) {
    const severity = maxSeverity(sslItems);
    const sslDisabled = sslItems.some((i) =>
      i.summary.toLowerCase().includes('disabled') ||
      i.summary.toLowerCase().includes('no longer detected'),
    );
    events.push({
      id: `${bucket.scanId}:ssl`,
      scanId: bucket.scanId,
      detectedAt: bucket.detectedAt,
      title: sslDisabled ? 'SSL/HTTPS disabled' : 'SSL status changed',
      summary: sslItems[0].summary,
      recommendation: recommendationFor('ssl_status_changed', sslDisabled ? 'critical' : severity, sslItems),
      severity: sslDisabled ? 'critical' : severity,
      category: 'ssl_status_changed',
      categoryLabel: CATEGORY_LABELS.ssl_status_changed,
      affectedAreas: ['SSL & HTTPS'],
      isImportant: true,
      technicalDetails: sslItems,
    });
  }

  if (processed.newThirdParty.length > 0 && securityItems.length === 0) {
    events.push(buildThirdPartyEvent(bucket, processed.newThirdParty, websiteUrl));
  } else if (processed.newThirdParty.length > 0) {
    events.push(buildThirdPartyEvent(bucket, processed.newThirdParty, websiteUrl));
  }

  if (processed.inlineScripts.length > 0) {
    events.push({
      id: `${bucket.scanId}:inline-scripts`,
      scanId: bucket.scanId,
      detectedAt: bucket.detectedAt,
      title: 'Inline script detected',
      summary: `${processed.inlineScripts.length} new inline script${processed.inlineScripts.length === 1 ? '' : 's'} on the page.`,
      recommendation: recommendationFor('website_asset_update', 'medium', processed.inlineScripts),
      severity: 'medium',
      category: 'website_asset_update',
      categoryLabel: CATEGORY_LABELS.website_asset_update,
      affectedAreas: ['Inline scripts'],
      isImportant: true,
      technicalDetails: processed.inlineScripts,
    });
  }

  if (assetCount > 0 && securityItems.length === 0) {
    const versionOnly =
      processed.versionBumps.length > 0 &&
      processed.newSameDomain.length === 0 &&
      processed.removedScripts.length === 0;
    events.push(
      buildAssetUpdateEvent(
        bucket,
        assetDetails,
        versionOnly ? 'low' : assetCount >= 5 ? 'medium' : 'low',
      ),
    );
  }

  if (loginItems.length > 0) {
    const severity = maxSeverity(loginItems);
    events.push({
      id: `${bucket.scanId}:login`,
      scanId: bucket.scanId,
      detectedAt: bucket.detectedAt,
      title: 'Login or page structure changed',
      summary: `${loginItems.length} change${loginItems.length === 1 ? '' : 's'} to login forms or page endpoints.`,
      recommendation: recommendationFor('login_or_form_changed', severity, loginItems),
      severity,
      category: 'login_or_form_changed',
      categoryLabel: CATEGORY_LABELS.login_or_form_changed,
      affectedAreas: ['Login & endpoints'],
      isImportant: isImportantEvent('login_or_form_changed', severity),
      technicalDetails: loginItems,
    });
  }

  if (metaItems.length > 0) {
    const severity = maxSeverity(metaItems);
    events.push({
      id: `${bucket.scanId}:meta`,
      scanId: bucket.scanId,
      detectedAt: bucket.detectedAt,
      title: metaItems.length === 1 ? 'Page meta tag changed' : 'Page meta tags changed',
      summary: `${metaItems.length} meta tag change${metaItems.length === 1 ? '' : 's'} detected.`,
      recommendation: recommendationFor('content_meta_changed', severity, metaItems),
      severity: severity === 'critical' ? 'medium' : severity,
      category: 'content_meta_changed',
      categoryLabel: CATEGORY_LABELS.content_meta_changed,
      affectedAreas: ['Page meta'],
      isImportant: isImportantEvent('content_meta_changed', severity),
      technicalDetails: metaItems,
    });
  }

  const remaining = bucket.items.filter((i) => !consumed.has(i.id));
  if (remaining.length > 0) {
    events.push({
      id: `${bucket.scanId}:misc`,
      scanId: bucket.scanId,
      detectedAt: bucket.detectedAt,
      title: 'Website change detected',
      summary: `${remaining.length} additional change${remaining.length === 1 ? '' : 's'} recorded.`,
      recommendation: recommendationFor('website_asset_update', maxSeverity(remaining), remaining),
      severity: maxSeverity(remaining),
      category: 'website_asset_update',
      categoryLabel: CATEGORY_LABELS.website_asset_update,
      affectedAreas: ['Other'],
      isImportant: isImportantEvent('website_asset_update', maxSeverity(remaining)),
      technicalDetails: remaining,
    });
  }

  return events;
}

export function sortGroupedTimelineEvents(events: GroupedTimelineEvent[]): GroupedTimelineEvent[] {
  return [...events].sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
  });
}

export function transformTimelineEvents(
  rawItems: ChangeTimelineItem[],
  options: TransformTimelineOptions,
): GroupedTimelineEvent[] {
  if (rawItems.length === 0) return [];

  const buckets = groupByScan(rawItems);
  const allEvents: GroupedTimelineEvent[] = [];

  for (const bucket of buckets) {
    allEvents.push(...processScanBucket(bucket, options.websiteUrl, options.baselineScanIds));
  }

  return sortGroupedTimelineEvents(allEvents);
}

export function filterTimelineEvents(
  events: GroupedTimelineEvent[],
  filter: TimelineFilter,
): GroupedTimelineEvent[] {
  switch (filter) {
    case 'important':
      return events.filter((e) => e.isImportant);
    case 'security':
      return events.filter(
        (e) =>
          e.category === 'security_protection_changed' ||
          e.category === 'ssl_status_changed' ||
          (e.category === 'new_third_party_service' &&
            (e.severity === 'high' || e.severity === 'critical')),
      );
    case 'website_updates':
      return events.filter(
        (e) =>
          e.category === 'website_asset_update' || e.category === 'content_meta_changed',
      );
    case 'technical':
    case 'all':
    default:
      return events;
  }
}

export function businessCategoryLabel(category: BusinessChangeCategory): string {
  return CATEGORY_LABELS[category];
}
