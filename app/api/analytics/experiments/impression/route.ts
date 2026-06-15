import { NextRequest, NextResponse } from 'next/server';
import { recordImpression, type ExperimentVariant } from '@/lib/analytics/experiments';

export async function POST(req: NextRequest) {
  let body: { experiment?: string; variant?: ExperimentVariant };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false });
  }

  const { experiment, variant } = body;
  if (!experiment || (variant !== 'a' && variant !== 'b')) {
    return NextResponse.json({ ok: false });
  }

  try {
    await recordImpression(experiment, variant);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
