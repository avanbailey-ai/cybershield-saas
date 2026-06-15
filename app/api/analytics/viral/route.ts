import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { refreshViralScore } from '@/lib/referrals/rewards';
import { emitEvent } from '@/lib/brain/eventBus';

export async function POST(req: NextRequest) {
  let body: {
    event_type?: string;
    session_id?: string;
    user_id?: string;
    metadata?: Record<string, unknown>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType = body.event_type;
  if (!eventType || typeof eventType !== 'string') {
    return NextResponse.json({ error: 'event_type is required' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from('viral_events').insert({
    event_type: eventType,
    session_id: body.session_id ?? null,
    user_id: body.user_id ?? null,
    metadata: body.metadata ?? {},
  });

  if (error) {
    console.error('[viral] insert failed:', error);
    return NextResponse.json({ error: 'Failed to track event' }, { status: 500 });
  }

  if (body.user_id && (eventType === 'scan_shared' || eventType === 'link_copied')) {
    void refreshViralScore(body.user_id).catch((err) =>
      console.error('[viral] score refresh failed:', err),
    );
  }

  if (eventType === 'scan_shared' || eventType === 'link_copied') {
    void emitEvent(
      'referral_created',
      body.metadata ?? {},
      body.user_id ?? null,
      body.session_id ?? null,
    );
  }
  if (eventType === 'referral_converted') {
    void emitEvent(
      'referral_converted',
      body.metadata ?? {},
      body.user_id ?? null,
      body.session_id ?? null,
    );
  }

  return NextResponse.json({ ok: true });
}
