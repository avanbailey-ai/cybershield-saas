import { NextRequest, NextResponse } from 'next/server';
import { trackReferralClick } from '@/lib/referrals/trackClick';

export async function POST(req: NextRequest) {
  let body: { type?: string; code?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (body.type !== 'click') {
    return NextResponse.json({ error: 'Unsupported type' }, { status: 400 });
  }

  const code = body.code?.trim();
  if (!code) {
    return NextResponse.json({ error: 'code is required' }, { status: 400 });
  }

  const referrerIp =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null;

  const { tracked } = await trackReferralClick({ referralCode: code, referrerIp });
  return NextResponse.json({ tracked });
}
