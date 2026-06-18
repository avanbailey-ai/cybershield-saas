import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildChangeComparison,
  type ChangeSeverity,
  type ChangeType,
  type ScanChange,
} from '@/lib/scanner/diffDetection';
import { buildSnapshotFromDbRow } from '@/lib/scanner/pageSnapshot';
import type { ScanSnapshot } from '@/lib/scanner/pageSnapshot';
import {
  changeCategoryLabel,
  type ChangeTimelineItem,
  type ChangeTimelinePeriod,
  type GroupedTimelineEvent,
  periodStartDate,
} from './changeTimeline';
import {
  filterTimelineEvents,
  transformTimelineEvents,
  type TimelineFilter,
} from './transformTimelineEvents';

export { filterTimelineEvents };
export type { TimelineFilter };

type ScanRow = {
  id: string;
  completed_at: string | null;
  ssl_valid: boolean | null;
  headers: unknown;
  scan_snapshot: unknown;
};

function enrichChangeRow(
  row: {
    id: string;
    scan_id: string;
    type: string;
    severity: string;
    description: string;
    detected_at: string;
  },
  currentSnapshot: ScanSnapshot | null,
  previousSnapshot: ScanSnapshot | null,
): ChangeTimelineItem {
  const change: ScanChange = {
    type: row.type as ChangeType,
    severity: row.severity as ChangeSeverity,
    description: row.description,
    detectedAt: row.detected_at,
  };

  let before = '—';
  let after = row.description;

  if (currentSnapshot && previousSnapshot) {
    const comparison = buildChangeComparison(previousSnapshot, currentSnapshot, change);
    before = comparison.before;
    after = comparison.after;
  }

  return {
    id: row.id,
    scanId: row.scan_id,
    type: row.type,
    category: changeCategoryLabel(row.type),
    severity: row.severity,
    summary: row.description,
    detectedAt: row.detected_at,
    before,
    after,
  };
}

export interface WebsiteChangeTimelineResult {
  website: { id: string; url: string; label: string | null };
  period: ChangeTimelinePeriod;
  events: GroupedTimelineEvent[];
  rawChangeCount: number;
  /** @deprecated Use `events` — raw rows preserved inside each event's technicalDetails */
  changes: ChangeTimelineItem[];
}

export async function fetchWebsiteChangeTimeline(
  supabase: SupabaseClient,
  websiteId: string,
  period: ChangeTimelinePeriod,
): Promise<WebsiteChangeTimelineResult | null> {
  const { data: website, error: websiteError } = await supabase
    .from('websites')
    .select('id, url, label')
    .eq('id', websiteId)
    .maybeSingle();

  if (websiteError || !website) return null;

  const since = periodStartDate(period).toISOString();

  const { data: changeRows, error: changesError } = await supabase
    .from('scan_changes')
    .select('id, scan_id, type, severity, description, detected_at')
    .eq('website_id', websiteId)
    .gte('detected_at', since)
    .order('detected_at', { ascending: false })
    .limit(200);

  if (changesError) {
    console.error('[changeTimeline] fetch changes failed:', changesError);
    return { website, period, events: [], rawChangeCount: 0, changes: [] };
  }

  const { data: scanRows } = await supabase
    .from('scans')
    .select('id, completed_at, ssl_valid, headers, scan_snapshot')
    .eq('website_id', websiteId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(120);

  const scans = (scanRows ?? []) as ScanRow[];
  const snapshotByScanId = new Map<string, ScanSnapshot>();
  for (const scan of scans) {
    const snap = buildSnapshotFromDbRow(scan);
    if (snap) snapshotByScanId.set(scan.id, snap);
  }

  const previousByScanId = new Map<string, ScanSnapshot | null>();
  for (let i = 0; i < scans.length; i++) {
    const prev = i + 1 < scans.length ? snapshotByScanId.get(scans[i + 1].id) ?? null : null;
    previousByScanId.set(scans[i].id, prev);
  }

  const baselineScanIds = new Set<string>();
  for (const [scanId, prev] of previousByScanId) {
    if (prev === null) baselineScanIds.add(scanId);
  }

  const changes = (changeRows ?? []).map((row) =>
    enrichChangeRow(
      row,
      snapshotByScanId.get(row.scan_id) ?? null,
      previousByScanId.get(row.scan_id) ?? null,
    ),
  );

  const events = transformTimelineEvents(changes, {
    websiteUrl: website.url,
    baselineScanIds,
  });

  return {
    website,
    period,
    events,
    rawChangeCount: changes.length,
    changes,
  };
}

export function fetchImportantTimelineEvents(
  result: WebsiteChangeTimelineResult,
  limit = 5,
): GroupedTimelineEvent[] {
  return filterTimelineEvents(result.events, 'important').slice(0, limit);
}
