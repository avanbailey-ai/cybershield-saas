/** Server-side analytics — non-blocking inserts into analytics_events. */

import { createAdminClient } from '@/lib/supabase/admin';
import type { AnalyticsEventMetadata, AnalyticsEventType } from './events';

const SERVER_EVENT_TYPES = new Set<string>([
  'scan_created',
  'scan_completed',
  'scan_failed',
  'scan_started',
  'upgrade_clicked',
]);

export async function trackServerEvent(
  eventType: AnalyticsEventType | string,
  metadata: AnalyticsEventMetadata = {},
  userId?: string | null,
): Promise<void> {
  if (!SERVER_EVENT_TYPES.has(eventType)) return;

  try {
    const supabase = createAdminClient();
    await supabase.from('analytics_events').insert({
      event_type: eventType,
      user_id: userId ?? null,
      session_id: null,
      metadata,
    });
  } catch (err) {
    console.error('[trackServerEvent] insert failed (non-fatal)', { eventType, err });
  }
}
