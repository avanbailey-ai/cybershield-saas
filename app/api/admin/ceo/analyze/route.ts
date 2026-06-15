import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/owner';
import { runCeoAnalysis } from '@/lib/ceo/analyze';

/**
 * POST /api/admin/ceo/analyze — owner only.
 * Computes metrics, generates insights, stores alerts. ADVISORY ONLY — no auto-apply.
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
    const result = await runCeoAnalysis();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[ceo/analyze] failed:', err);
    return NextResponse.json({ error: 'CEO analysis failed' }, { status: 500 });
  }
}
