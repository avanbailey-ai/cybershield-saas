import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { setupResendMailDomain } from '@/lib/email/resendMailDomain';

export const dynamic = 'force-dynamic';

/** Owner-only: ensure mail.cybershieldcloud.com exists in Resend and return DNS records to publish. */
export async function POST() {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  try {
    const result = await setupResendMailDomain();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Resend setup failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
