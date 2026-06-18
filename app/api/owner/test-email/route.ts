import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { sendEmail, getResendFromAddress, isResendSandboxFrom } from '@/lib/email';

/** Owner-only: send a test email to verify Resend customer delivery. */
export async function POST(req: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const to = typeof body.to === 'string' ? body.to.trim() : '';
  if (!to || !to.includes('@')) {
    return NextResponse.json({ error: 'Valid "to" email required' }, { status: 400 });
  }

  const from = getResendFromAddress();
  const sandbox = isResendSandboxFrom(from);

  const result = await sendEmail({
    to,
    subject: 'CyberShield — customer email delivery test',
    html: `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;padding:24px;">
      <h1 style="color:#0f172a;">Delivery test OK</h1>
      <p>If you received this, Resend is delivering to customer inboxes from <strong>${from}</strong>.</p>
      <p style="color:#64748b;font-size:14px;">Sent from Founder OS test endpoint.</p>
    </body></html>`,
  });

  return NextResponse.json({
    ok: result.success,
    to,
    from: result.from ?? from,
    sandbox,
    messageId: result.messageId ?? null,
    error: result.error ?? null,
    hint: sandbox
      ? 'EMAIL_FROM is still on resend.dev — verify cybershieldcloud.com in Resend and set EMAIL_FROM=CyberShield <alerts@cybershieldcloud.com> in Vercel.'
      : result.success
        ? 'Customer delivery path looks good.'
        : 'Check Resend dashboard — domain must be verified for this from address.',
  });
}
