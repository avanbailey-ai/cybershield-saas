import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import {
  generateSocialContent,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
} from '@/lib/owner/generators/social';

export async function GET() {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }
  return NextResponse.json({ ok: true, platforms: SOCIAL_PLATFORMS });
}

export async function POST(req: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const body = await req.json();
  const platform = body.platform as SocialPlatform;

  if (!platform || !SOCIAL_PLATFORMS.some((p) => p.id === platform)) {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
  }

  const content = generateSocialContent(platform, {
    topic: body.topic ?? 'Website security matters',
    audience: body.audience,
    keyPoints: body.keyPoints,
    cta: body.cta,
  });

  return NextResponse.json({ ok: true, platform, content });
}
