/**
 * Verify change timeline helpers.
 * Run: npx tsx scripts/verify-change-timeline.ts
 */

import {
  parseChangeTimelinePeriod,
  periodStartDate,
  changeCategoryLabel,
} from '../lib/scanChanges/changeTimeline';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(parseChangeTimelinePeriod('day') === 'day', 'day period');
assert(parseChangeTimelinePeriod(undefined) === 'week', 'default week');
assert(parseChangeTimelinePeriod('invalid') === 'week', 'invalid -> week');

const weekStart = periodStartDate('week', new Date('2026-06-18T12:00:00Z'));
assert(weekStart.toISOString().startsWith('2026-06-11'), 'week start');

assert(changeCategoryLabel('ssl_changed') === 'SSL & HTTPS', 'ssl category');
assert(changeCategoryLabel('script_added') === 'Third-Party Scripts', 'script category');

console.log('All change timeline checks passed.');
