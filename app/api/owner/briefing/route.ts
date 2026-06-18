import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { generateDailyBriefing } from '@/lib/owner/briefing';

export async function GET() {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  try {
    const briefing = await generateDailyBriefing();
    return NextResponse.json({ ok: true, briefing });
  } catch (err) {
    console.error('[owner/briefing]', err);
    return NextResponse.json({ error: 'Failed to generate briefing' }, { status: 500 });
  }
}
