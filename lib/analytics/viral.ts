import { getSessionId } from '@/lib/analytics/events';

export type ViralEventType =
  | 'scan_shared'
  | 'link_copied'
  | 'referral_clicked'
  | 'referral_signed_up'
  | 'referral_converted';

export interface ViralEventMetadata {
  domain?: string;
  score?: number;
  shareToken?: string;
  referralCode?: string;
  channel?: string;
  [key: string]: unknown;
}

export async function trackViralEvent(
  type: ViralEventType,
  metadata: ViralEventMetadata = {},
  userId?: string,
): Promise<void> {
  const sessionId = getSessionId();
  const payload = {
    event_type: type,
    session_id: sessionId,
    metadata: { ...metadata, sessionId },
    ...(userId ? { user_id: userId } : {}),
  };

  try {
    await fetch('/api/analytics/viral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Non-blocking
  }
}
