import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserBrainState } from '@/lib/brain/controller';

/**
 * GET /api/brain/state — brain state for client components.
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id') ?? undefined;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const state = await getUserBrainState(user?.id, sessionId);
    return NextResponse.json(state);
  } catch (err) {
    console.error('[brain/state] failed:', err);
    return NextResponse.json({
      intentScore: 0,
      churnRisk: 0,
      funnelStage: 'anonymous',
      recommendedAction: 'none',
    });
  }
}
