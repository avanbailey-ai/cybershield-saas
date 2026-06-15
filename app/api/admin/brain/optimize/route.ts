import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/owner';
import { runOptimizer } from '@/lib/brain/optimizer';
import { runChurnScanner } from '@/lib/brain/churnScanner';
import { runAutopilotAnalysis } from '@/lib/analytics/autopilot';

/**
 * POST /api/admin/brain/optimize — owner only: insights + safe optimizer + churn scan.
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
    const [optimizerResult, churnResult, autopilotReport] = await Promise.all([
      runOptimizer(true),
      runChurnScanner(),
      runAutopilotAnalysis(),
    ]);

    return NextResponse.json({
      ok: true,
      applied: optimizerResult.applied,
      insights: optimizerResult.insights,
      churn: churnResult,
      autopilot: autopilotReport,
    });
  } catch (err) {
    console.error('[admin/brain/optimize] failed:', err);
    return NextResponse.json({ error: 'Brain optimization failed' }, { status: 500 });
  }
}
