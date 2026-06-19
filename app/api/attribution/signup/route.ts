import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  PROSPECT_ATTRIBUTION_COOKIE,
  captureSignupAttribution,
  isValidAttributionToken,
} from '@/lib/owner/prospectAttribution';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const bodyToken = typeof body.token === 'string' ? body.token.trim() : '';

  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(PROSPECT_ATTRIBUTION_COOKIE)?.value ?? '';

  // Body token (sessionStorage) takes precedence; cookie is the durable fallback.
  const token = isValidAttributionToken(bodyToken) ? bodyToken : cookieToken;

  if (!isValidAttributionToken(token)) {
    return NextResponse.json({ error: 'token required' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const result = await captureSignupAttribution(admin, token, user.id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true, prospectId: result.prospectId });
  response.cookies.set(PROSPECT_ATTRIBUTION_COOKIE, '', { maxAge: 0, path: '/' });
  return response;
}
