import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { generateVideoAd, generateVideoAdVersions, VIDEO_DURATIONS } from '@/lib/owner/generators/video';

export async function GET() {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }
  return NextResponse.json({ ok: true, durations: VIDEO_DURATIONS });
}

export async function POST(req: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const body = await req.json();
  const duration = Number(body.duration) as 15 | 30 | 60 | 90;

  if (!VIDEO_DURATIONS.includes(duration)) {
    return NextResponse.json({ error: 'Invalid duration' }, { status: 400 });
  }

  const multiVersion = body.multiVersion === true;
  const input = {
    product: body.product ?? 'CyberShield',
    audience: body.audience ?? 'small business owners',
    painPoint: body.painPoint ?? 'Website security blind spots',
    cta: body.cta ?? 'Start your free security scan today',
    duration,
  };

  if (multiVersion) {
    const scripts = generateVideoAdVersions(input, body.versionCount ?? 3);
    return NextResponse.json({ ok: true, scripts });
  }

  const script = generateVideoAd({ ...input, version: body.version ?? 1 });

  return NextResponse.json({ ok: true, script });
}
