import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/owner';
import { runAutopilotAnalysis } from '@/lib/analytics/autopilot';

/**
 * POST /api/admin/autopilot/run — owner only, runs funnel analysis and updates config.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isOwner(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const report = await runAutopilotAnalysis();
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    console.error('[autopilot/run] failed:', err);
    return NextResponse.json(
      { error: 'Autopilot analysis failed' },
      { status: 500 },
    );
  }
}
