import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { improveDraftWithLocalAi } from '@/lib/intelligence/localAi';

/** Owner-only optional local AI draft improvement — never required for core product. */
export async function POST(req: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const body = (await req.json()) as { draft?: string; context?: string };
  if (!body.draft?.trim()) {
    return NextResponse.json({ error: 'draft required' }, { status: 400 });
  }

  const result = await improveDraftWithLocalAi({
    draft: body.draft.trim(),
    context: body.context?.trim(),
  });

  return NextResponse.json({
    ok: true,
    improved: result.improved,
    source: result.source,
    error: result.error ?? null,
  });
}
