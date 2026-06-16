export {
  trackEvent,
  getSessionId,
  type AnalyticsEventType as ConversionEventType,
  type AnalyticsEventMetadata as ConversionEventMetadata,
} from '@/lib/analytics/events';

export {
  evaluateScanFunnel,
  getPlanSegment,
  shouldShowGrowthUpgradeNudge,
  type ScanFunnelResult,
} from '@/lib/funnel';
