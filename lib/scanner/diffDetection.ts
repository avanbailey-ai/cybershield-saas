import type { ScanSnapshot } from './pageSnapshot';

export type ChangeSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ChangeType =
  | 'script_added'
  | 'script_removed'
  | 'meta_tag_changed'
  | 'security_header_changed'
  | 'ssl_changed'
  | 'login_form_changed'
  | 'endpoint_added'
  | 'endpoint_removed';

export interface ScanChange {
  type: ChangeType;
  severity: ChangeSeverity;
  description: string;
  detectedAt: string;
}

export interface DiffResult {
  changes: ScanChange[];
  hasCritical: boolean;
}

const CRITICAL_HEADERS = new Set(['content-security-policy', 'strict-transport-security']);
const HIGH_HEADERS = new Set(['x-frame-options', 'x-content-type-options']);

const SECURITY_META_KEYS = new Set([
  'content-security-policy',
  'referrer',
  'robots',
  'google-site-verification',
]);

function setDiff<T>(prev: T[], next: T[]): { added: T[]; removed: T[] } {
  const prevSet = new Set(prev);
  const nextSet = new Set(next);
  return {
    added: next.filter((item) => !prevSet.has(item)),
    removed: prev.filter((item) => !nextSet.has(item)),
  };
}

function headerSeverity(headerName: string, removed: boolean): ChangeSeverity {
  if (CRITICAL_HEADERS.has(headerName)) {
    return removed ? 'critical' : 'medium';
  }
  if (HIGH_HEADERS.has(headerName)) {
    return removed ? 'high' : 'low';
  }
  return removed ? 'medium' : 'low';
}

function scriptSeverity(added: boolean, script: string): ChangeSeverity {
  if (!added) return 'low';
  if (script.startsWith('inline:')) return 'medium';
  if (/cdn|googleapis|cloudflare|unpkg|jsdelivr/i.test(script)) return 'medium';
  return 'high';
}

function endpointSeverity(added: boolean, endpoint: string): ChangeSeverity {
  if (!added) return 'low';
  if (/\/admin\b|\/webhook|\/graphql/i.test(endpoint)) return 'high';
  if (/\/api\b|\/auth\b|\/login\b/i.test(endpoint)) return 'medium';
  return 'medium';
}

/** Compare two scan snapshots and return structured change list. */
export function detectScanChanges(
  previous: ScanSnapshot | null,
  current: ScanSnapshot,
  detectedAt: string = new Date().toISOString(),
): DiffResult {
  if (!previous) {
    return { changes: [], hasCritical: false };
  }

  const changes: ScanChange[] = [];

  if (previous.ssl !== current.ssl) {
    changes.push({
      type: 'ssl_changed',
      severity: current.ssl ? 'medium' : 'critical',
      description: current.ssl
        ? 'HTTPS/SSL was enabled since the last scan'
        : 'HTTPS/SSL was disabled or is no longer detected',
      detectedAt,
    });
  }

  const headerKeys = new Set([
    ...Object.keys(previous.securityHeaders),
    ...Object.keys(current.securityHeaders),
  ]);

  for (const headerName of headerKeys) {
    const prevValue = previous.securityHeaders[headerName];
    const nextValue = current.securityHeaders[headerName];

    if (prevValue === nextValue) continue;

    if (prevValue && !nextValue) {
      changes.push({
        type: 'security_header_changed',
        severity: headerSeverity(headerName, true),
        description: `Security header removed: ${headerName}`,
        detectedAt,
      });
    } else if (!prevValue && nextValue) {
      changes.push({
        type: 'security_header_changed',
        severity: headerSeverity(headerName, false),
        description: `Security header added: ${headerName}`,
        detectedAt,
      });
    } else {
      changes.push({
        type: 'security_header_changed',
        severity: CRITICAL_HEADERS.has(headerName) ? 'high' : 'medium',
        description: `Security header changed: ${headerName}`,
        detectedAt,
      });
    }
  }

  const metaKeys = new Set([...Object.keys(previous.metaTags), ...Object.keys(current.metaTags)]);
  for (const key of metaKeys) {
    const prevValue = previous.metaTags[key];
    const nextValue = current.metaTags[key];
    if (prevValue === nextValue) continue;

    const severity: ChangeSeverity =
      SECURITY_META_KEYS.has(key) || key.startsWith('og:') ? 'medium' : 'low';

    changes.push({
      type: 'meta_tag_changed',
      severity,
      description:
        prevValue === undefined
          ? `Meta tag added: ${key}`
          : nextValue === undefined
            ? `Meta tag removed: ${key}`
            : `Meta tag changed: ${key}`,
      detectedAt,
    });
  }

  const scriptDiff = setDiff(previous.scripts, current.scripts);
  for (const script of scriptDiff.added) {
    changes.push({
      type: 'script_added',
      severity: scriptSeverity(true, script),
      description: `Script added: ${script}`,
      detectedAt,
    });
  }
  for (const script of scriptDiff.removed) {
    changes.push({
      type: 'script_removed',
      severity: scriptSeverity(false, script),
      description: `Script removed: ${script}`,
      detectedAt,
    });
  }

  if (previous.loginFormDetected !== current.loginFormDetected) {
    changes.push({
      type: 'login_form_changed',
      severity: current.loginFormDetected ? 'medium' : 'low',
      description: current.loginFormDetected
        ? 'Login form detected on page (was not present before)'
        : 'Login form no longer detected on page',
      detectedAt,
    });
  }

  const endpointDiff = setDiff(previous.endpoints, current.endpoints);
  for (const endpoint of endpointDiff.added) {
    changes.push({
      type: 'endpoint_added',
      severity: endpointSeverity(true, endpoint),
      description: `New endpoint found in HTML: ${endpoint}`,
      detectedAt,
    });
  }
  for (const endpoint of endpointDiff.removed) {
    changes.push({
      type: 'endpoint_removed',
      severity: endpointSeverity(false, endpoint),
      description: `Endpoint no longer found in HTML: ${endpoint}`,
      detectedAt,
    });
  }

  const hasCritical = changes.some((change) => change.severity === 'critical');
  return { changes, hasCritical };
}

/** Whether changes should trigger a user-facing alert (medium+ or any critical). */
export function shouldAlertOnChanges(diff: DiffResult): boolean {
  if (diff.hasCritical) return true;
  return diff.changes.some((change) =>
    change.severity === 'medium' || change.severity === 'high' || change.severity === 'critical',
  );
}

/** Build alert title/message from detected changes. */
export function formatChangeAlert(url: string, changes: ScanChange[]): { title: string; message: string } {
  const top = changes
    .slice()
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .slice(0, 5);

  const title = `Website changes detected on ${url}`;
  const message =
    top.map((change) => `[${change.severity.toUpperCase()}] ${change.description}`).join('\n') +
    (changes.length > 5 ? `\n…and ${changes.length - 5} more change(s)` : '');

  return { title, message };
}

function severityRank(severity: ChangeSeverity): number {
  switch (severity) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    default:
      return 1;
  }
}

export function maxChangeSeverity(changes: ScanChange[]): ChangeSeverity {
  if (changes.length === 0) return 'low';
  return changes.reduce<ChangeSeverity>(
    (max, change) => (severityRank(change.severity) > severityRank(max) ? change.severity : max),
    'low',
  );
}

/** Monitoring email alert types for continuous security notifications. */
export type MonitoringAlertType =
  | 'security_score_drop'
  | 'change_detected'
  | 'ssl_changed'
  | 'header_removed'
  | 'new_script_detected';

export interface MonitoringChangeDetail {
  label: string;
  severity: ChangeSeverity;
  summary: string;
  before: string;
  after: string;
}

const RECOMMENDED_FIXES: Record<MonitoringAlertType, string> = {
  security_score_drop:
    'Review the latest scan report, address the new findings, and re-scan to confirm your score recovers. Share the report with your developer if fixes require server or CMS changes.',
  change_detected:
    'Verify this change was intentional. If not, roll back the recent deployment and review who has publish access to your site.',
  ssl_changed:
    'If HTTPS was disabled, restore a valid TLS certificate immediately. If HTTPS was newly enabled, confirm redirects from HTTP and check certificate expiry.',
  header_removed:
    'Re-add the missing security header in your web server or CDN configuration. Test with a fresh scan after deploying the fix.',
  new_script_detected:
    'Confirm the new script is from a trusted vendor. Remove unknown third-party scripts and tighten your Content-Security-Policy to block unauthorized sources.',
};

/** Map scan diff / legacy alert types to monitoring email alert types. */
export function mapChangeToMonitoringAlertType(change: ScanChange): MonitoringAlertType {
  switch (change.type) {
    case 'ssl_changed':
      return 'ssl_changed';
    case 'security_header_changed':
      return change.description.startsWith('Security header removed')
        ? 'header_removed'
        : 'change_detected';
    case 'script_added':
      return 'new_script_detected';
    default:
      return 'change_detected';
  }
}

/** Map alerts table type values to monitoring email alert types. */
export function mapAlertTypeToMonitoring(type: string): MonitoringAlertType {
  switch (type) {
    case 'security_score_drop':
    case 'change_detected':
    case 'ssl_changed':
    case 'header_removed':
    case 'new_script_detected':
      return type;
    case 'ssl':
      return 'ssl_changed';
    case 'website_change':
      return 'change_detected';
    case 'security_issue':
    case 'risk_increase':
      return 'security_score_drop';
    default:
      return 'change_detected';
  }
}

export function getRecommendedFixForAlertType(type: MonitoringAlertType): string {
  return RECOMMENDED_FIXES[type];
}

function headerNameFromDescription(description: string): string | null {
  const match = description.match(/Security header (?:removed|added|changed): (.+)$/);
  return match?.[1] ?? null;
}

function scriptFromDescription(description: string): string | null {
  const match = description.match(/Script (?:added|removed): (.+)$/);
  return match?.[1] ?? null;
}

/** Build before/after comparison strings for a detected change. */
export function buildChangeComparison(
  previous: ScanSnapshot,
  current: ScanSnapshot,
  change: ScanChange,
): { before: string; after: string } {
  switch (change.type) {
    case 'ssl_changed':
      return {
        before: previous.ssl ? 'HTTPS enabled' : 'HTTPS not detected',
        after: current.ssl ? 'HTTPS enabled' : 'HTTPS not detected',
      };
    case 'security_header_changed': {
      const headerName = headerNameFromDescription(change.description);
      if (!headerName) {
        return { before: '—', after: change.description };
      }
      return {
        before: previous.securityHeaders[headerName] ?? '(not present)',
        after: current.securityHeaders[headerName] ?? '(not present)',
      };
    }
    case 'script_added':
    case 'script_removed': {
      const script = scriptFromDescription(change.description);
      if (change.type === 'script_added') {
        return { before: '(not present)', after: script ?? change.description };
      }
      return { before: script ?? change.description, after: '(removed)' };
    }
    case 'meta_tag_changed': {
      const keyMatch = change.description.match(/Meta tag (?:added|removed|changed): (.+)$/);
      const key = keyMatch?.[1];
      if (!key) return { before: '—', after: change.description };
      return {
        before: previous.metaTags[key] ?? '(not present)',
        after: current.metaTags[key] ?? '(not present)',
      };
    }
    case 'login_form_changed':
      return {
        before: previous.loginFormDetected ? 'Login form present' : 'No login form',
        after: current.loginFormDetected ? 'Login form present' : 'No login form',
      };
    case 'endpoint_added':
    case 'endpoint_removed': {
      const endpointMatch = change.description.match(/(?:New endpoint found|Endpoint no longer found) in HTML: (.+)$/);
      const endpoint = endpointMatch?.[1];
      if (change.type === 'endpoint_added') {
        return { before: '(not present)', after: endpoint ?? change.description };
      }
      return { before: endpoint ?? change.description, after: '(removed)' };
    }
    default:
      return { before: '—', after: change.description };
  }
}

export function buildMonitoringChangeDetails(
  previous: ScanSnapshot | null,
  current: ScanSnapshot,
  changes: ScanChange[],
): MonitoringChangeDetail[] {
  if (!previous) {
    return changes.map((change) => ({
      label: change.type.replace(/_/g, ' '),
      severity: change.severity,
      summary: change.description,
      before: '—',
      after: change.description,
    }));
  }

  return changes.map((change) => {
    const comparison = buildChangeComparison(previous, current, change);
    return {
      label: change.type.replace(/_/g, ' '),
      severity: change.severity,
      summary: change.description,
      before: comparison.before,
      after: comparison.after,
    };
  });
}

/** Group alertable changes by monitoring email alert type. */
export function groupChangesByMonitoringAlertType(
  changes: ScanChange[],
): Map<MonitoringAlertType, ScanChange[]> {
  const groups = new Map<MonitoringAlertType, ScanChange[]>();
  for (const change of changes) {
    if (change.severity === 'low') continue;
    const alertType = mapChangeToMonitoringAlertType(change);
    const existing = groups.get(alertType) ?? [];
    existing.push(change);
    groups.set(alertType, existing);
  }
  return groups;
}
