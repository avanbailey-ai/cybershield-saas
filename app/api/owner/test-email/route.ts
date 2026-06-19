import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { sendEmail, getResendFromAddress, isResendSandboxFrom } from '@/lib/email';
import { getReplyToAddress, isMailSubdomainConfigured } from '@/lib/email/config';

/**
 * Owner-only: verify Resend customer delivery.
 *
 * Body: { to: string, dryRun?: boolean }
 *  - dryRun (or missing RESEND_API_KEY) returns the resolved config without sending.
 */
export async function POST(req: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const to = typeof body.to === 'string' ? body.to.trim() : '';
  const dryRun = body.dryRun === true;

  if (!to || !to.includes('@')) {
    return NextResponse.json({ error: 'Valid "to" email required' }, { status: 400 });
  }

  const from = getResendFromAddress();
  const replyTo = getReplyToAddress();
  const sandbox = isResendSandboxFrom(from);
  const hasApiKey = Boolean(process.env.RESEND_API_KEY);

  const config = {
    from,
    replyTo,
    sandbox,
    hasApiKey,
    mailSubdomainConfigured: isMailSubdomainConfigured(),
    sendingDomain: from.match(/@([a-zA-Z0-9.-]+)/)?.[1] ?? null,
  };

  if (dryRun || !hasApiKey) {
    return NextResponse.json({
      ok: false,
      dryRun: true,
      to,
      config,
      hint: !hasApiKey
        ? 'RESEND_API_KEY is not set — sending is disabled. Set it in Vercel env.'
        : 'Dry run only — no email sent. Config resolved successfully.',
    });
  }

  const result = await sendEmail({
    to,
    subject: 'CyberShield — customer email delivery test',
    html: `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;padding:24px;">
      <h1 style="color:#0f172a;">Delivery test OK</h1>
      <p>If you received this, Resend is delivering to customer inboxes from <strong>${from}</strong>.</p>
      <p style="color:#64748b;font-size:14px;">Sent from Founder OS test endpoint.</p>
    </body></html>`,
    text: `Delivery test OK\n\nIf you received this, Resend is delivering to customer inboxes from ${from}.\n\nSent from Founder OS test endpoint.`,
    category: 'system',
  });

  return NextResponse.json({
    ok: result.success,
    to,
    config,
    from: result.from ?? from,
    sandbox,
    messageId: result.messageId ?? null,
    error: result.error ?? null,
    hint: sandbox
      ? 'EMAIL_FROM is still on resend.dev — verify cybershieldcloud.com in Resend and set EMAIL_FROM=CyberShield <outreach@cybershieldcloud.com> in Vercel.'
      : result.success
        ? 'Customer delivery path looks good.'
        : 'Check Resend dashboard — domain must be verified for this from address.',
  });
}
