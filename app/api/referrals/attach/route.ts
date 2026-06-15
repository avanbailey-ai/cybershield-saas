import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { attachReferralOnSignup } from '@/lib/referrals/attach';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { referralCode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const referralCode =
    body.referralCode?.trim() ??
    req.cookies.get('cybershield_ref')?.value?.trim();

  if (!referralCode) {
    return NextResponse.json({ attached: false, reason: 'no_code' });
  }

  const referrerIp =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null;

  const result = await attachReferralOnSignup({
    userId: user.id,
    email: user.email,
    referralCode,
    referrerIp,
  });

  return NextResponse.json(result);
}
