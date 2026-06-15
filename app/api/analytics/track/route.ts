import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { AnalyticsEventType } from '@/lib/analytics/events';
import { emitEvent, type SystemEventType } from '@/lib/brain/eventBus';

const VALID_EVENTS: AnalyticsEventType[] = [
  'page_view',
  'scan_created',
  'scan_started',
  'scan_completed',
  'scan_failed',
  'report_viewed',
  'paywall_viewed',
  'upgrade_clicked',
  'checkout_started',
  'checkout_completed',
  'bounce_pricing',
  'scroll_depth',
  'time_on_page',
];

/**
 * POST /api/analytics/track — insert analytics event (always 200, non-blocking).
 */
export async function POST(req: NextRequest) {
  let body: {
    event_type?: string;
    session_id?: string;
    metadata?: Record<string, unknown>;
    user_id?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true, logged: false });
  }

  const { event_type, session_id, metadata = {}, user_id: bodyUserId } = body;

  if (!event_type || !VALID_EVENTS.includes(event_type as AnalyticsEventType)) {
    return NextResponse.json({ ok: true, logged: false });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from('analytics_events').insert({
      event_type,
      user_id: bodyUserId ?? user?.id ?? null,
      session_id: session_id ?? null,
      metadata,
    });

    if (error) {
      console.error('[analytics/track] insert failed:', error.message);
    }

    const brainTypes: SystemEventType[] = [
      'scan_created',
      'scan_started',
      'scan_completed',
      'scan_failed',
      'report_viewed',
      'paywall_viewed',
      'upgrade_clicked',
      'checkout_started',
      'checkout_completed',
    ];
    if (brainTypes.includes(event_type as SystemEventType)) {
      void emitEvent(
        event_type as SystemEventType,
        metadata,
        bodyUserId ?? user?.id ?? null,
        session_id ?? null,
      );
    }

    return NextResponse.json({ ok: true, logged: !error });
  } catch (err) {
    console.error('[analytics/track] unhandled error:', err);
    return NextResponse.json({ ok: true, logged: false });
  }
}
