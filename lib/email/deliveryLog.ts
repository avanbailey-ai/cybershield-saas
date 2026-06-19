import type { SupabaseClient } from '@supabase/supabase-js';
import type { EmailCategory } from './config';

export interface LogDeliveryInput {
  resendMessageId?: string | null;
  recipientEmail: string;
  subject: string;
  category: EmailCategory;
  template?: string;
  prospectId?: string | null;
  draftId?: string | null;
  userId?: string | null;
  attributionToken?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logEmailDelivery(
  admin: SupabaseClient,
  input: LogDeliveryInput,
): Promise<string | null> {
  const { data, error } = await admin
    .from('owner_email_deliveries')
    .insert({
      resend_message_id: input.resendMessageId ?? null,
      recipient_email: input.recipientEmail.toLowerCase(),
      subject: input.subject,
      category: input.category,
      template: input.template ?? null,
      prospect_id: input.prospectId ?? null,
      draft_id: input.draftId ?? null,
      user_id: input.userId ?? null,
      attribution_token: input.attributionToken ?? null,
      status: 'sent',
      metadata: input.metadata ?? {},
    })
    .select('id')
    .single();

  if (error) return null;
  return data?.id as string;
}

export async function logEngagementEvent(
  admin: SupabaseClient,
  input: {
    deliveryId?: string | null;
    resendMessageId?: string | null;
    prospectId?: string | null;
    eventType:
      | 'delivered'
      | 'opened'
      | 'clicked'
      | 'replied'
      | 'bounced'
      | 'complained'
      | 'unsubscribed';
    linkUrl?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await admin.from('owner_email_engagement_events').insert({
    delivery_id: input.deliveryId ?? null,
    resend_message_id: input.resendMessageId ?? null,
    prospect_id: input.prospectId ?? null,
    event_type: input.eventType,
    link_url: input.linkUrl ?? null,
    metadata: input.metadata ?? {},
  });

  if (input.deliveryId && input.eventType !== 'clicked') {
    await admin
      .from('owner_email_deliveries')
      .update({ status: input.eventType, updated_at: new Date().toISOString() })
      .eq('id', input.deliveryId);
  }
}

export async function findDeliveryByResendId(
  admin: SupabaseClient,
  resendMessageId: string,
): Promise<{ id: string; prospect_id: string | null } | null> {
  const { data } = await admin
    .from('owner_email_deliveries')
    .select('id, prospect_id')
    .eq('resend_message_id', resendMessageId)
    .maybeSingle();
  return data as { id: string; prospect_id: string | null } | null;
}
