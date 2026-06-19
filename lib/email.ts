import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getResendFromAddress,
  isResendSandboxFrom,
  type EmailCategory,
} from '@/lib/email/config';
import { getReplyToAddress } from '@/lib/email/config';
import { logEmailDelivery } from '@/lib/email/deliveryLog';
import { injectOpenPixel, wrapLinksWithTracking } from '@/lib/email/tracking';

export interface SendEmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  category?: EmailCategory;
  replyTo?: string;
  template?: string;
  prospectId?: string;
  draftId?: string;
  userId?: string;
  attributionToken?: string;
  trackOpens?: boolean;
  trackClicks?: boolean;
  tags?: { name: string; value: string }[];
}

export { getResendFromAddress, isResendSandboxFrom } from '@/lib/email/config';
export type { EmailCategory } from '@/lib/email/config';

export async function sendEmail(
  payload: SendEmailPayload,
): Promise<{
  success: boolean;
  error?: string;
  messageId?: string;
  from?: string;
  deliveryId?: string;
}> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not set — skipping email send');
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  const category = payload.category ?? 'system';
  const from = getResendFromAddress(category);
  const replyTo = payload.replyTo ?? getReplyToAddress(category);

  if (isResendSandboxFrom(from)) {
    console.warn(
      `[Email] Sandbox from (${from}). Set EMAIL_FROM or verify mail.${process.env.EMAIL_SENDING_DOMAIN ?? 'mail.cybershieldcloud.com'} in Resend.`,
    );
  }

  const admin = createAdminClient();
  let deliveryId: string | null = null;
  let html = payload.html;
  let text = payload.text;

  if (payload.trackOpens !== false || payload.trackClicks !== false) {
    deliveryId = await logEmailDelivery(admin, {
      recipientEmail: payload.to,
      subject: payload.subject,
      category,
      template: payload.template,
      prospectId: payload.prospectId,
      draftId: payload.draftId,
      userId: payload.userId,
      attributionToken: payload.attributionToken,
    });

    if (deliveryId) {
      if (payload.trackClicks !== false) {
        html = wrapLinksWithTracking(html, deliveryId);
      }
      if (payload.trackOpens !== false) {
        html = injectOpenPixel(html, deliveryId);
      }
    }
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: payload.to,
      subject: payload.subject,
      html,
      text: text ?? undefined,
      replyTo,
      tags: payload.tags,
    });

    if (error) {
      console.error('[Email] Send failed:', error);
      if (deliveryId) {
        await admin
          .from('owner_email_deliveries')
          .update({ status: 'failed', failure_reason: error.message })
          .eq('id', deliveryId);
      }
      return { success: false, error: error.message, from };
    }

    if (deliveryId && data?.id) {
      await admin
        .from('owner_email_deliveries')
        .update({ resend_message_id: data.id })
        .eq('id', deliveryId);
    } else if (data?.id) {
      deliveryId = await logEmailDelivery(admin, {
        resendMessageId: data.id,
        recipientEmail: payload.to,
        subject: payload.subject,
        category,
        template: payload.template,
        prospectId: payload.prospectId,
        draftId: payload.draftId,
        userId: payload.userId,
        attributionToken: payload.attributionToken,
      });
    }

    return {
      success: true,
      messageId: data?.id,
      from,
      deliveryId: deliveryId ?? undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Email] Exception:', msg);
    return { success: false, error: msg, from };
  }
}
