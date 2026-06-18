/**
 * Verify change timeline noise reduction grouping.
 * Run: npx tsx scripts/verify-change-timeline-noise-reduction.ts
 */

import type { ChangeTimelineItem } from '../lib/scanChanges/changeTimeline';
import {
  filterTimelineEvents,
  normalizeScriptUrl,
  transformTimelineEvents,
} from '../lib/scanChanges/transformTimelineEvents';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const WEBSITE_URL = 'https://example.com';
const SCAN_ID = 'scan-test-001';
const DETECTED_AT = '2026-06-17T12:00:00.000Z';

function rawItem(
  overrides: Partial<ChangeTimelineItem> & Pick<ChangeTimelineItem, 'id' | 'type' | 'summary'>,
): ChangeTimelineItem {
  return {
    scanId: SCAN_ID,
    category: 'Third-Party Scripts',
    severity: 'low',
    detectedAt: DETECTED_AT,
    before: '—',
    after: overrides.summary,
    ...overrides,
  };
}

// 1. Query param version bump → one website_asset_update, low severity
{
  const items: ChangeTimelineItem[] = [
    rawItem({
      id: '1',
      type: 'script_removed',
      summary: 'Script removed: https://example.com/js/vcart.js?vcart=26.21.2',
      before: 'https://example.com/js/vcart.js?vcart=26.21.2',
      after: '(removed)',
    }),
    rawItem({
      id: '2',
      type: 'script_added',
      summary: 'Script added: https://example.com/js/vcart.js?vcart=26.23.0',
      before: '(not present)',
      after: 'https://example.com/js/vcart.js?vcart=26.23.0',
    }),
  ];
  const events = transformTimelineEvents(items, { websiteUrl: WEBSITE_URL });
  assert(events.length === 1, 'version bump should collapse to one event');
  assert(events[0].category === 'website_asset_update', 'version bump category');
  assert(events[0].severity === 'low', 'version bump severity low');
}

// 2. Capitalization/path slash diff → not two scary events
{
  const normA = normalizeScriptUrl('/Js/App.js', WEBSITE_URL);
  const normB = normalizeScriptUrl('js/app.js', WEBSITE_URL);
  assert(normA.normalizedKey === normB.normalizedKey, 'path normalization matches');

  const items: ChangeTimelineItem[] = [
    rawItem({
      id: '3',
      type: 'script_removed',
      summary: 'Script removed: /Js/App.js',
    }),
    rawItem({
      id: '4',
      type: 'script_added',
      summary: 'Script added: js/app.js',
    }),
  ];
  const events = transformTimelineEvents(items, { websiteUrl: WEBSITE_URL });
  assert(events.length === 1, 'case/path diff should be one event');
  assert(events[0].severity === 'low', 'case/path diff should be low severity');
}

// 3. Multiple same-scan script changes → one collapsed card
{
  const items: ChangeTimelineItem[] = [
    rawItem({ id: '5', type: 'script_added', summary: 'Script added: https://example.com/a.js' }),
    rawItem({ id: '6', type: 'script_added', summary: 'Script added: https://example.com/b.js' }),
    rawItem({ id: '7', type: 'script_removed', summary: 'Script removed: https://example.com/c.js' }),
  ];
  const events = transformTimelineEvents(items, { websiteUrl: WEBSITE_URL });
  assert(events.length === 1, 'multiple same-scan scripts collapse');
  assert(events[0].technicalDetails.length === 3, 'technical details preserved');
}

// 4. HSTS removed → critical, security_protection_changed
{
  const items: ChangeTimelineItem[] = [
    rawItem({
      id: '8',
      type: 'security_header_changed',
      severity: 'critical',
      summary: 'Security header removed: strict-transport-security',
      category: 'Security Headers',
    }),
  ];
  const events = transformTimelineEvents(items, { websiteUrl: WEBSITE_URL });
  assert(events.length === 1, 'single security event');
  assert(events[0].category === 'security_protection_changed', 'security category');
  assert(events[0].severity === 'critical', 'HSTS removed is critical');
  assert(events[0].title.toLowerCase().includes('critical'), 'critical title');
}

// 5. First scan baseline → monitoring_baseline_established, not 40 added
{
  const baselineItems: ChangeTimelineItem[] = Array.from({ length: 40 }, (_, i) =>
    rawItem({
      id: `baseline-${i}`,
      type: 'script_added',
      summary: `Script added: https://example.com/asset-${i}.js`,
    }),
  );
  const events = transformTimelineEvents(baselineItems, {
    websiteUrl: WEBSITE_URL,
    baselineScanIds: new Set([SCAN_ID]),
  });
  assert(events.length === 1, 'baseline collapses to one event');
  assert(events[0].category === 'monitoring_baseline_established', 'baseline category');
}

// 6. New external script domain → high, new_third_party_service
{
  const items: ChangeTimelineItem[] = [
    rawItem({
      id: '9',
      type: 'script_added',
      severity: 'high',
      summary: 'Script added: https://evil-tracker.io/pixel.js',
    }),
  ];
  const events = transformTimelineEvents(items, { websiteUrl: WEBSITE_URL });
  assert(events.length === 1, 'third party event');
  assert(events[0].category === 'new_third_party_service', 'third party category');
  assert(events[0].severity === 'high', 'third party high severity');
}

// 7. Default important filter hides low asset updates
{
  const items: ChangeTimelineItem[] = [
    rawItem({
      id: '10',
      type: 'script_removed',
      summary: 'Script removed: https://example.com/app.js?v=1',
    }),
    rawItem({
      id: '11',
      type: 'script_added',
      summary: 'Script added: https://example.com/app.js?v=2',
    }),
  ];
  const events = transformTimelineEvents(items, { websiteUrl: WEBSITE_URL });
  const important = filterTimelineEvents(events, 'important');
  assert(events[0].severity === 'low', 'asset update is low');
  assert(important.length === 0, 'important filter hides low asset updates');
  assert(filterTimelineEvents(events, 'all').length === 1, 'all filter shows asset update');
}

// HSTS + asset changes same scan → primary security card with alsoDetected
{
  const items: ChangeTimelineItem[] = [
    rawItem({
      id: '12',
      type: 'security_header_changed',
      severity: 'critical',
      summary: 'Security header removed: strict-transport-security',
      category: 'Security Headers',
    }),
    ...Array.from({ length: 20 }, (_, i) =>
      rawItem({
        id: `asset-${i}`,
        type: 'script_added',
        summary: `Script added: https://example.com/lib-${i}.js`,
      }),
    ),
  ];
  const events = transformTimelineEvents(items, { websiteUrl: WEBSITE_URL });
  const security = events.find((e) => e.category === 'security_protection_changed');
  assert(security != null, 'security event present');
  assert(Boolean(security!.alsoDetected?.includes('20')), 'alsoDetected mentions asset count');
}

console.log('All change timeline noise reduction checks passed.');
