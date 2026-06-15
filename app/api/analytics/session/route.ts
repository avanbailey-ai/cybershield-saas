import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/analytics/session?session_id=xxx
 * Returns analytics events for session in last 24h.
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id');
  if (!sessionId) {
    return NextResponse.json({ events: [] });
  }

  const since = new Date();
  since.setHours(since.getHours() - 24);

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('analytics_events')
      .select('id, event_type, session_id, metadata, created_at')
      .eq('session_id', sessionId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[analytics/session] query failed:', error.message);
      return NextResponse.json({ events: [] });
    }

    return NextResponse.json({ events: data ?? [] });
  } catch (err) {
    console.error('[analytics/session] unhandled error:', err);
    return NextResponse.json({ events: [] });
  }
}
