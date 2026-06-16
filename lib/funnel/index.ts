export type {
  ConversionTier,
  FunnelSegment,
  RecommendedPlan,
  ScanFunnelInput,
  ScanFunnelResult,
} from './types';

export {
  countHighSeverityIssues,
  countCriticalIssues,
  hasComplianceFlags,
  detectNoImprovement,
  evaluateScanFunnel,
  getPlanSegment,
  shouldShowGrowthUpgradeNudge,
} from './evaluate';

export { readAndRecordDomainScore } from './client';

export {
  FUNNEL_KEYS,
  saveFunnelSession,
  readFunnelSession,
  buildPricingHref,
  parseFunnelFromSearchParams,
  hostnameFromUrl,
} from './session';
export type { FunnelSessionState } from './session';
