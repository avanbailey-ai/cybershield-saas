import type { SupabaseClient } from '@supabase/supabase-js';

export type OutreachEventType =
  | 'email_sent'
  | 'email_approved'
  | 'email_failed'
  | 'follow_up_scheduled'
  | 'follow_up_due'
  | 'follow_up_sent'
  | 'contact_found'
  | 'retention_sent'
  | 'customer_status_updated'
  | 'prospect_interested'
  | 'prospect_signup'
  | 'prospect_converted';

export async function logOutreachEvent(
  admin: SupabaseClient,
  input: {
    draft_id?: string | null;
    prospect_id?: string | null;
    event_type: OutreachEventType;
    recipient_email?: string | null;
    resend_message_id?: string | null;
    subject?: string | null;
    detail?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await admin.from('owner_outreach_events').insert({
    draft_id: input.draft_id ?? null,
    prospect_id: input.prospect_id ?? null,
    event_type: input.event_type,
    recipient_email: input.recipient_email ?? null,
    resend_message_id: input.resend_message_id ?? null,
    subject: input.subject ?? null,
    detail: input.detail ?? null,
    metadata: input.metadata ?? {},
  });
}
