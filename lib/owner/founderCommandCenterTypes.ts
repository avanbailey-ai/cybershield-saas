/** Founder Command Center — types for the rebuilt Founder OS dashboard. */

export interface MetricValue {
  value: number | null;
  label: string;
  /** When null, show empty state instead of zero if tracking is unavailable. */
  available: boolean;
  emptyReason?: string;
  emptySource?: string;
  emptyAction?: string;
}

export interface OverviewMetrics {
  generatedAt: string;
  totalUsers: number;
  signupsToday: number;
  signups7d: number;
  signups30d: number;
  totalWebsites: number;
  totalScans: number;
  freeScans30d: MetricValue;
  loggedInScans30d: MetricValue;
  paidMonitoredWebsites: number;
  subscriptionsByPlan: Record<string, number>;
  mrr: number;
  arr: number;
  failedPayments: number;
  canceledSubscriptions: number;
  signupToPaidConversionPct: MetricValue;
  scanToSignupConversionPct: MetricValue;
  freeScanToPaidConversionPct: MetricValue;
  emailsAlertsSent30d: MetricValue;
  reportsViewed30d: MetricValue;
  recentScans: { id: string; createdAt: string; score: number | null; status: string | null }[];
}

export interface FunnelStageRow {
  stage: string;
  label: string;
  count: number;
  dropoffPct: number;
}

export interface FunnelMetrics {
  generatedAt: string;
  windowDays: number;
  stages: FunnelStageRow[];
  pageViews30d: MetricValue;
  pricingPageViews30d: MetricValue;
  signups30d: number;
  analyticsAvailable: boolean;
  analyticsEmptyAction?: string;
}

export interface ProductUsageMetrics {
  generatedAt: string;
  activeAccounts: { email: string; plan: string; websites: number; scans30d: number }[];
  monitoredWebsites: number;
  scans30d: number;
  failedScans30d: number;
  websitesWithScoreChanges30d: MetricValue;
  websitesWithNewRisks30d: MetricValue;
  avgSecurityScore: number | null;
  findingsBySeverity: { severity: string; count: number }[];
  topFindingCategories: { category: string; count: number }[];
  reportViews30d: MetricValue;
}

export interface RevenueMetrics {
  generatedAt: string;
  mrr: number;
  arr: number;
  activePaidAccounts: number;
  subscriptionsByPlan: Record<string, number>;
  trialingUsers: number;
  freeUsers: number;
  canceledUsers: number;
  recentPayments: MetricValue;
  failedPayments: number;
  monthlyGrossRevenue: number;
  monthlyCosts: number | null;
  netEstimate: number | null;
  costsConfigured: boolean;
}

export interface MarketingActionItem {
  id: string;
  title: string;
  description: string;
  done: boolean;
}

export interface MarketingMetrics {
  generatedAt: string;
  outreachDraftsPending: number;
  outreachSent30d: number;
  campaignsCount: number;
  emailsSent30d: number;
  repliesTracked: MetricValue;
  freeScanPageViews30d: MetricValue;
  ctaClicks30d: MetricValue;
  actions: MarketingActionItem[];
  checklists: { id: string; title: string; items: { label: string; done: boolean }[] }[];
}

export interface SalesLeadRow {
  id: string;
  name: string;
  company: string | null;
  status: string;
  source: string | null;
  planOffered: string | null;
  nextFollowUp: string | null;
  notes: string | null;
  updatedAt: string;
}

export interface SalesCrmMetrics {
  generatedAt: string;
  leads: SalesLeadRow[];
  stageCounts: Record<string, number>;
  crmAvailable: boolean;
}

export interface SiteContentEntry {
  key: string;
  label: string;
  location: string;
  editable: boolean;
  note: string;
}

export interface SiteContentMap {
  generatedAt: string;
  entries: SiteContentEntry[];
  cmsAvailable: boolean;
}

export interface FounderAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  action: string;
}

export interface OperationsMetrics {
  generatedAt: string;
  alerts: FounderAlert[];
  overallStatus: 'healthy' | 'warning' | 'critical';
}

export interface FounderDailyBrief {
  generatedAt: string;
  windowHours: number;
  changes: { label: string; value: string }[];
  suggestedActions: { title: string; detail: string; section: string }[];
}

export interface FounderCommandCenterData {
  generatedAt: string;
  overview: OverviewMetrics;
  funnel: FunnelMetrics;
  product: ProductUsageMetrics;
  revenue: RevenueMetrics;
  marketing: MarketingMetrics;
  sales: SalesCrmMetrics;
  siteContent: SiteContentMap;
  operations: OperationsMetrics;
  dailyBrief: FounderDailyBrief;
}

export const EMPTY_FOUNDER_COMMAND_CENTER: FounderCommandCenterData = {
  generatedAt: new Date(0).toISOString(),
  overview: {
    generatedAt: new Date(0).toISOString(),
    totalUsers: 0,
    signupsToday: 0,
    signups7d: 0,
    signups30d: 0,
    totalWebsites: 0,
    totalScans: 0,
    freeScans30d: { value: null, label: 'Free scans (30d)', available: false },
    loggedInScans30d: { value: null, label: 'Logged-in scans (30d)', available: false },
    paidMonitoredWebsites: 0,
    subscriptionsByPlan: {},
    mrr: 0,
    arr: 0,
    failedPayments: 0,
    canceledSubscriptions: 0,
    signupToPaidConversionPct: { value: null, label: 'Signup → paid', available: false },
    scanToSignupConversionPct: { value: null, label: 'Scan → signup', available: false },
    freeScanToPaidConversionPct: { value: null, label: 'Free scan → paid', available: false },
    emailsAlertsSent30d: { value: null, label: 'Emails/alerts sent (30d)', available: false },
    reportsViewed30d: { value: null, label: 'Reports viewed (30d)', available: false },
    recentScans: [],
  },
  funnel: {
    generatedAt: new Date(0).toISOString(),
    windowDays: 30,
    stages: [],
    pageViews30d: { value: null, label: 'Page views', available: false },
    pricingPageViews30d: { value: null, label: 'Pricing views', available: false },
    signups30d: 0,
    analyticsAvailable: false,
    analyticsEmptyAction: 'Enable client analytics on marketing pages to populate funnel data.',
  },
  product: {
    generatedAt: new Date(0).toISOString(),
    activeAccounts: [],
    monitoredWebsites: 0,
    scans30d: 0,
    failedScans30d: 0,
    websitesWithScoreChanges30d: { value: null, label: 'Score changes', available: false },
    websitesWithNewRisks30d: { value: null, label: 'New risks', available: false },
    avgSecurityScore: null,
    findingsBySeverity: [],
    topFindingCategories: [],
    reportViews30d: { value: null, label: 'Report views', available: false },
  },
  revenue: {
    generatedAt: new Date(0).toISOString(),
    mrr: 0,
    arr: 0,
    activePaidAccounts: 0,
    subscriptionsByPlan: {},
    trialingUsers: 0,
    freeUsers: 0,
    canceledUsers: 0,
    recentPayments: { value: null, label: 'Recent payments', available: false },
    failedPayments: 0,
    monthlyGrossRevenue: 0,
    monthlyCosts: null,
    netEstimate: null,
    costsConfigured: false,
  },
  marketing: {
    generatedAt: new Date(0).toISOString(),
    outreachDraftsPending: 0,
    outreachSent30d: 0,
    campaignsCount: 0,
    emailsSent30d: 0,
    repliesTracked: { value: null, label: 'Replies', available: false },
    freeScanPageViews30d: { value: null, label: 'Free scan page views', available: false },
    ctaClicks30d: { value: null, label: 'CTA clicks', available: false },
    actions: [],
    checklists: [],
  },
  sales: {
    generatedAt: new Date(0).toISOString(),
    leads: [],
    stageCounts: {},
    crmAvailable: true,
  },
  siteContent: {
    generatedAt: new Date(0).toISOString(),
    entries: [],
    cmsAvailable: false,
  },
  operations: {
    generatedAt: new Date(0).toISOString(),
    alerts: [],
    overallStatus: 'healthy',
  },
  dailyBrief: {
    generatedAt: new Date(0).toISOString(),
    windowHours: 24,
    changes: [],
    suggestedActions: [],
  },
};
