import type { ChangeSeverity, ChangeType } from '@/lib/scanner/diffDetection';

export type ChangeTimelinePeriod = 'day' | 'week' | 'month';

export const CHANGE_TIMELINE_PERIODS: ChangeTimelinePeriod[] = ['day', 'week', 'month'];

export function parseChangeTimelinePeriod(raw: string | undefined): ChangeTimelinePeriod {
  if (raw === 'day' || raw === 'week' || raw === 'month') return raw;
  return 'week';
}

export function periodStartDate(period: ChangeTimelinePeriod, now = new Date()): Date {
  const start = new Date(now);
  if (period === 'day') {
    start.setUTCDate(start.getUTCDate() - 1);
  } else if (period === 'week') {
    start.setUTCDate(start.getUTCDate() - 7);
  } else {
    start.setUTCDate(start.getUTCDate() - 30);
  }
  return start;
}

const CATEGORY_LABELS: Record<ChangeType, string> = {
  ssl_changed: 'SSL & HTTPS',
  security_header_changed: 'Security Headers',
  script_added: 'Third-Party Scripts',
  script_removed: 'Third-Party Scripts',
  meta_tag_changed: 'Page Meta',
  login_form_changed: 'Login Page',
  endpoint_added: 'Page Structure',
  endpoint_removed: 'Page Structure',
};

export function changeCategoryLabel(type: string): string {
  return CATEGORY_LABELS[type as ChangeType] ?? 'Website Change';
}

export function severityBadgeClass(severity: string): string {
  switch (severity as ChangeSeverity) {
    case 'critical':
      return 'bg-red-500/15 text-red-300 border-red-500/30';
    case 'high':
      return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
    case 'medium':
      return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30';
    default:
      return 'bg-gray-500/15 text-gray-300 border-gray-500/30';
  }
}

export function formatTimelineTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export interface ChangeTimelineItem {
  id: string;
  scanId: string;
  type: string;
  category: string;
  severity: string;
  summary: string;
  detectedAt: string;
  before: string;
  after: string;
}
