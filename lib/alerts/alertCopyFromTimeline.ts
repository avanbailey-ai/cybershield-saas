import type { ScanChange } from '@/lib/scanner/diffDetection';
import { changeCategoryLabel, type ChangeTimelineItem } from '@/lib/scanChanges/changeTimeline';
import {
  transformTimelineEvents,
  type GroupedTimelineEvent,
} from '@/lib/scanChanges/transformTimelineEvents';

export interface AlertCopy {
  title: string;
  message: string;
  recommendation: string;
  categoryLabel?: string;
}

export function scanChangesToTimelineItems(
  changes: ScanChange[],
  scanId: string,
): ChangeTimelineItem[] {
  return changes.map((c, i) => ({
    id: `${scanId}:${i}`,
    scanId,
    type: c.type,
    category: changeCategoryLabel(c.type),
    severity: c.severity,
    summary: c.description,
    detectedAt: c.detectedAt,
    before: '—',
    after: c.description,
  }));
}

export function groupedEventsFromScanChanges(
  websiteUrl: string,
  scanId: string,
  changes: ScanChange[],
): GroupedTimelineEvent[] {
  const items = scanChangesToTimelineItems(changes, scanId);
  return transformTimelineEvents(items, { websiteUrl });
}

/** Business-friendly alert copy from raw scan changes (same grouping as change timeline). */
export function alertCopyFromScanChanges(
  websiteUrl: string,
  scanId: string,
  changes: ScanChange[],
): AlertCopy {
  const events = groupedEventsFromScanChanges(websiteUrl, scanId, changes);

  if (events.length === 0) {
    const count = changes.length;
    return {
      title: 'Website change detected',
      message: `${count} change${count === 1 ? '' : 's'} detected on ${websiteUrl}.`,
      recommendation: 'Review this change and confirm it matches your expected site updates.',
    };
  }

  if (events.length === 1) {
    const event = events[0]!;
    return {
      title: event.title,
      message: event.summary,
      recommendation: event.recommendation,
      categoryLabel: event.categoryLabel,
    };
  }

  const primary = events[0]!;
  const otherLabels = [...new Set(events.slice(1).map((e) => e.categoryLabel))];
  return {
    title: `${primary.categoryLabel} — ${changes.length} changes detected`,
    message: `${primary.summary}${
      otherLabels.length > 0 ? ` Also detected: ${otherLabels.join(', ')}.` : ''
    }`,
    recommendation: primary.recommendation,
    categoryLabel: primary.categoryLabel,
  };
}

const CHANGE_ALERT_TYPES = new Set([
  'change_detected',
  'header_removed',
  'new_script_detected',
  'ssl_changed',
  'website_change',
  'security_header_changed',
  'script_added',
]);

export function isChangeBasedAlertType(type: string): boolean {
  return CHANGE_ALERT_TYPES.has(type);
}

/** Soften legacy bracket-prefixed messages for inbox display. */
export function softenStoredAlertMessage(message: string): string {
  const lines = message.split('\n').map((line) => line.trim()).filter(Boolean);
  const softened = lines
    .map((line) => line.replace(/^\[(?:CRITICAL|HIGH|MEDIUM|LOW)\]\s*/i, ''))
    .filter((line) => !line.startsWith('…and ') && !line.startsWith('...and '));
  return softened.join(' ') || message;
}

export function emailWhyItMattersFromCopy(
  copy: Pick<AlertCopy, 'recommendation' | 'message'>,
  isWorsened: boolean,
): string {
  if (copy.recommendation) return copy.recommendation;
  if (isWorsened) {
    return 'This issue worsened since your last check. Review the recommended next step in your dashboard.';
  }
  return copy.message || 'CyberShield detected a meaningful change that may need your attention.';
}
