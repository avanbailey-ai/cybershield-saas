import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { emitEvent, type SystemEventType } from '@/lib/brain/eventBus';

const VALID_BRAIN_EVENTS: SystemEventType[] = [
  'scan_started',
  'scan_completed',
  'report_viewed',
  'paywall_viewed',
  'upgrade_clicked',
  'checkout_started',
  'checkout_completed',
  'referral_created',
  'referral_converted',
  'enterprise_lead_created',
  'churn_risk_detected',
  'retention_email_sent',
  'brain_optimization_applied',
];

/**
 * POST /api/brain/events — ingest unified system events.
 */
export async function POST(req: NextRequest) {
  let body: {
    event_type?: string;
    session_id?: string;
    metadata?: Record<string, unknown>;
    user_id?: string;
    source?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true, logged: false });
  }

  const { event_type, session_id, metadata = {}, user_id: bodyUserId } = body;

  if (!event_type || !VALID_BRAIN_EVENTS.includes(event_type as SystemEventType)) {
    return NextResponse.json({ ok: true, logged: false });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await emitEvent(
      event_type as SystemEventType,
      metadata,
      bodyUserId ?? user?.id ?? null,
      session_id ?? null,
      (body.source as 'app' | 'stripe' | 'webhook' | 'brain') ?? 'app',
    );

    return NextResponse.json({ ok: true, logged: true });
  } catch (err) {
    console.error('[brain/events] unhandled error:', err);
    return NextResponse.json({ ok: true, logged: false });
  }
}
