import type { AnalyticsEvent } from './events';

const MAX_SCAN_COMPLETED_POINTS = 30;
const SCAN_COMPLETED_WEIGHT = 15;

export function computeConversionIntentScore(events: AnalyticsEvent[]): number {
  if (!events.length) return 0;

  let score = 0;

  const scanCompletedCount = events.filter((e) => e.event_type === 'scan_completed').length;
  score += Math.min(scanCompletedCount * SCAN_COMPLETED_WEIGHT, MAX_SCAN_COMPLETED_POINTS);

  if (events.some((e) => e.event_type === 'paywall_viewed')) {
    score += 10;
  }

  const pricingPageView = events.some(
    (e) =>
      e.event_type === 'page_view' &&
      (e.metadata?.path === '/pricing' ||
        e.metadata?.path === '/onboarding' ||
        String(e.metadata?.path ?? '').includes('pricing')),
  );
  if (pricingPageView) {
    score += 15;
  }

  const maxScrollDepth = events
    .filter((e) => e.event_type === 'scroll_depth')
    .reduce((max, e) => Math.max(max, Number(e.metadata?.depth ?? 0)), 0);
  if (maxScrollDepth >= 75) {
    score += 10;
  }

  if (events.some((e) => e.event_type === 'checkout_started')) {
    score += 25;
  }

  if (events.some((e) => e.event_type === 'bounce_pricing')) {
    score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}
