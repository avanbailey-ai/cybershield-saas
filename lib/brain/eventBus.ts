import { createAdminClient } from '@/lib/supabase/admin';

export type SystemEventType =
  | 'scan_created'
  | 'scan_started'
  | 'scan_completed'
  | 'scan_failed'
  | 'report_viewed'
  | 'paywall_viewed'
  | 'upgrade_clicked'
  | 'checkout_started'
  | 'checkout_completed'
  | 'referral_created'
  | 'referral_converted'
  | 'enterprise_lead_created'
  | 'churn_risk_detected'
  | 'retention_email_sent'
  | 'brain_optimization_applied';

export type SystemEventSource = 'app' | 'stripe' | 'webhook' | 'brain';

export interface SystemEventMetadata {
  [key: string]: unknown;
}

/**
 * Unified event bus — dual-writes to system_events for the brain loop.
 * Non-blocking; failures are logged but never thrown to callers.
 */
export async function emitEvent(
  type: SystemEventType,
  metadata: SystemEventMetadata = {},
  userId?: string | null,
  sessionId?: string | null,
  source: SystemEventSource = 'app',
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from('system_events').insert({
      event_type: type,
      user_id: userId ?? null,
      session_id: sessionId ?? null,
      metadata,
      source,
    });

    if (error) {
      console.error('[brain/eventBus] insert failed:', error.message);
    }
  } catch (err) {
    console.error('[brain/eventBus] unhandled error:', err);
  }
}

/** Client-side helper — posts to brain events API (non-blocking). */
export function emitEventClient(
  type: SystemEventType,
  metadata: SystemEventMetadata = {},
  userId?: string,
  sessionId?: string,
): void {
  try {
    void fetch('/api/brain/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: type,
        metadata,
        user_id: userId,
        session_id: sessionId,
      }),
    });
  } catch {
    // Non-blocking
  }
}
