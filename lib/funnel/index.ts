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
