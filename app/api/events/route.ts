import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const VALID_EVENTS = [
  'page_view',
  'scan_started',
  'scan_completed',
  'report_viewed',
  'paywall_viewed',
  'upgrade_clicked',
  'checkout_started',
  'checkout_completed',
  'bounce_pricing',
  'scroll_depth',
  'time_on_page',
] as const;

type ValidEvent = (typeof VALID_EVENTS)[number];

/**
 * POST /api/events — legacy endpoint, inserts into analytics_events (always 200 on failure).
 */
export async function POST(req: NextRequest) {
  let body: {
    event_type?: string;
    session_id?: string;
    metadata?: Record<string, unknown>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true, logged: false });
  }

  const { event_type, session_id, metadata = {} } = body;

  if (!event_type || !VALID_EVENTS.includes(event_type as ValidEvent)) {
    return NextResponse.json({ ok: true, logged: false });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from('analytics_events').insert({
      event_type,
      user_id: user?.id ?? null,
      session_id: session_id ?? null,
      metadata,
    });

    if (error) {
      console.error('[events] insert failed:', error.message);
    }

    return NextResponse.json({ ok: true, logged: !error });
  } catch (err) {
    console.error('[events] unhandled error:', err);
    return NextResponse.json({ ok: true, logged: false });
  }
}
