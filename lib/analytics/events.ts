export type AnalyticsEventType =
  | 'page_view'
  | 'scan_created'
  | 'scan_started'
  | 'scan_completed'
  | 'scan_failed'
  | 'report_viewed'
  | 'paywall_viewed'
  | 'pricing_viewed'
  | 'upgrade_clicked'
  | 'enterprise_form_submitted'
  | 'checkout_started'
  | 'checkout_completed'
  | 'bounce_pricing'
  | 'scroll_depth'
  | 'time_on_page';

export interface AnalyticsEventMetadata {
  path?: string;
  score?: number;
  domain?: string;
  plan?: string;
  trigger?: string;
  depth?: number;
  seconds?: number;
  [key: string]: unknown;
}

export interface AnalyticsEvent {
  id?: string;
  event_type: AnalyticsEventType | string;
  session_id?: string | null;
  user_id?: string | null;
  metadata?: AnalyticsEventMetadata;
  created_at?: string;
}

const SESSION_KEY = 'cybershield_analytics_session_id';
const LEGACY_SESSION_KEY = 'cybershield_scan_session_id';

export function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';

  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = sessionStorage.getItem(LEGACY_SESSION_KEY);
  }
  if (!id) {
    id = crypto.randomUUID();
  }
  sessionStorage.setItem(SESSION_KEY, id);
  sessionStorage.setItem(LEGACY_SESSION_KEY, id);
  return id;
}

const BRAIN_EVENT_TYPES = new Set([
  'scan_created',
  'scan_started',
  'scan_completed',
  'scan_failed',
  'report_viewed',
  'paywall_viewed',
  'pricing_viewed',
  'upgrade_clicked',
  'enterprise_form_submitted',
  'checkout_started',
  'checkout_completed',
]);

export async function trackEvent(
  type: AnalyticsEventType,
  metadata: AnalyticsEventMetadata = {},
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
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (BRAIN_EVENT_TYPES.has(type)) {
      void fetch('/api/brain/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
  } catch {
    // Non-blocking — analytics must not break UX
  }
}
