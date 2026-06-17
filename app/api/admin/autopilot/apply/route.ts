import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/owner';
import { applyAutopilotConfigByKey } from '@/lib/brain/applyAutopilotConfig';
import { extractIp } from '@/lib/audit/log';

/**
 * POST /api/admin/autopilot/apply — owner only.
 * Applies whitelisted autopilot_config keys for a recommendation_key.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isOwner(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { recommendation_key?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const recommendationKey = body.recommendation_key;
  if (!recommendationKey || typeof recommendationKey !== 'string') {
    return NextResponse.json({ error: 'recommendation_key required' }, { status: 400 });
  }

  try {
    const ip = extractIp(req);
    const result = await applyAutopilotConfigByKey(
      recommendationKey,
      user.id,
      'manual_apply',
      ip,
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'Apply failed' }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      applied: result.applied,
      changed_keys: result.changedKeys,
    });
  } catch (err) {
    console.error('[autopilot/apply] failed:', err);
    return NextResponse.json({ error: 'Apply failed' }, { status: 500 });
  }
}
