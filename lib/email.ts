import { Resend } from 'resend';
import { getResendFromAddress, isResendSandboxFrom } from '@/lib/email/config';

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export { getResendFromAddress, isResendSandboxFrom } from '@/lib/email/config';

export async function sendEmail(
  payload: EmailPayload,
): Promise<{ success: boolean; error?: string; messageId?: string; from?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not set — skipping email send');
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  const from = getResendFromAddress();
  if (isResendSandboxFrom(from)) {
    console.warn(
      `[Email] Using Resend sandbox from (${from}). Only your Resend account email can receive mail. Set EMAIL_FROM to a verified domain for customer delivery.`,
    );
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });

    if (error) {
      console.error('[Email] Send failed:', error);
      return { success: false, error: error.message, from };
    }

    return { success: true, messageId: data?.id, from };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Email] Exception:', msg);
    return { success: false, error: msg, from };
  }
}
