import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/owner';
import { applyRecommendation } from '@/lib/ceo/safety';
import { auditLog, extractIp } from '@/lib/audit/log';

/**
 * POST /api/admin/ceo/apply — owner only, manual apply of a single recommendation.
 * ONLY updates whitelisted autopilot_config keys. Logs to audit_logs.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isOwner(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { recommendationId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const recId = body.recommendationId;
  if (!recId || typeof recId !== 'string') {
    return NextResponse.json({ error: 'recommendationId required' }, { status: 400 });
  }

  try {
    const ip = extractIp(req);
    const result = await applyRecommendation(recId, user.id, ip);

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'Apply failed' }, { status: 400 });
    }

    auditLog({
      userId: user.id,
      action: 'ceo_apply_api',
      metadata: { recommendationId: recId, applied: result.applied },
      ip,
    });

    return NextResponse.json({ ok: true, applied: result.applied });
  } catch (err) {
    console.error('[ceo/apply] failed:', err);
    return NextResponse.json({ error: 'Apply failed' }, { status: 500 });
  }
}
