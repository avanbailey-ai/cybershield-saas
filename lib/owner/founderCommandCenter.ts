/**
 * Founder Command Center — real metrics aggregator for the rebuilt Founder OS.
 * No fabricated data; empty states when tracking or records are unavailable.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { getFounderCustomerMetrics, PAYING_PLAN_IDS } from './founderCustomerMetrics';
import { isInternalCustomerProfile } from './internalAccountFilters';
import {
  computeFunnelDropoffs,
  loadUnifiedEventsForWindow,
  CEO_FUNNEL_STAGES,
} from '@/lib/ceo/funnel';
import {
  countAnalyticsEvents,
  countAnalyticsEventsWithUser,
  countEventByPathPrefix,
  daysAgo,
  hasAnalyticsData,
} from './founderAnalyticsQueries';
import { getAutomationHealth } from './automationHealth';
import type {
  FounderCommandCenterData,
  FounderDailyBrief,
  FounderAlert,
  MetricValue,
  MarketingActionItem,
  SiteContentEntry,
} from './founderCommandCenterTypes';
import { EMPTY_FOUNDER_COMMAND_CENTER } from './founderCommandCenterTypes';

const MS_DAY = 86400000;
const FUNNEL_WINDOW_DAYS = 30;

const STAGE_LABELS: Record<string, string> = {
  landing_view: 'Landing / page views',
  scan_started: 'Scan starts',
  scan_completed: 'Scan completions',
  report_viewed: 'Report / preview views',
  pricing_viewed: 'Pricing / paywall views',
  checkout_started: 'Checkout starts',
  checkout_completed: 'Paid subscriptions',
};

function metric(
  value: number | null,
  label: string,
  available: boolean,
  empty?: { reason: string; source: string; action: string },
): MetricValue {
  return {
    value,
    label,
    available,
    emptyReason: empty?.reason,
    emptySource: empty?.source,
    emptyAction: empty?.action,
  };
}

async function fetchOverview(now: Date): Promise<FounderCommandCenterData['overview']> {
  const admin = createAdminClient();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = daysAgo(7);
  const thirtyDaysAgo = daysAgo(30);

  const [
    profilesRes,
    websitesRes,
    scansTotalRes,
    scans30dRes,
    recentScansRes,
    signupsTodayRes,
    signups7dRes,
    signups30dRes,
    customerMetrics,
    analyticsExists,
    freeScans30d,
    loggedInScans30d,
    reportsViewed30d,
    alertsSent30d,
  ] = await Promise.all([
    admin.from('profiles').select('id, email, plan, subscription_status, created_at, is_qa_account'),
    admin.from('websites').select('id, user_id', { count: 'exact' }),
    admin.from('scans').select('id', { count: 'exact', head: true }),
    admin
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo.toISOString()),
    admin
      .from('scans')
      .select('id, created_at, score, status')
      .order('created_at', { ascending: false })
      .limit(8),
    admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString()),
    admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString()),
    admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo.toISOString()),
    getFounderCustomerMetrics(),
    hasAnalyticsData(),
    countAnalyticsEventsWithUser(['scan_started', 'scan_completed'], thirtyDaysAgo, false),
    countAnalyticsEventsWithUser(['scan_started', 'scan_completed'], thirtyDaysAgo, true),
    countAnalyticsEvents(['report_viewed'], thirtyDaysAgo),
    countAnalyticsEvents(['email_sent', 'alert_sent'], thirtyDaysAgo),
  ]);

  const profiles = (profilesRes.data ?? []).filter(
    (p) =>
      !isInternalCustomerProfile({
        email: (p.email as string) ?? '',
        is_qa_account: (p as { is_qa_account?: boolean }).is_qa_account ?? null,
        plan: (p.plan as string) ?? null,
      }),
  );

  const subscriptionsByPlan: Record<string, number> = {
    free: 0,
    pro: 0,
    growth: 0,
    agency: 0,
    enterprise: 0,
  };
  let failedPayments = 0;
  let canceledSubscriptions = 0;
  let upgradedInWindow = 0;

  for (const p of profiles) {
    const plan = ((p.plan as string) ?? 'free').toLowerCase();
    const status = ((p.subscription_status as string) ?? '').toLowerCase();
    if (plan in subscriptionsByPlan) subscriptionsByPlan[plan]++;
    else if (plan !== 'owner') subscriptionsByPlan.enterprise++;

    if (status === 'past_due' || status === 'unpaid') failedPayments++;
    if (status === 'canceled' || status === 'cancelled') canceledSubscriptions++;

    const created = p.created_at as string | undefined;
    if (
      created &&
      created >= thirtyDaysAgo.toISOString() &&
      PAYING_PLAN_IDS.includes(plan as (typeof PAYING_PLAN_IDS)[number]) &&
      status === 'active'
    ) {
      upgradedInWindow++;
    }
  }

  const payingUserIds = new Set(
    profiles
      .filter((p) => {
        const plan = ((p.plan as string) ?? 'free').toLowerCase();
        const status = ((p.subscription_status as string) ?? '').toLowerCase();
        return PAYING_PLAN_IDS.includes(plan as (typeof PAYING_PLAN_IDS)[number]) && status === 'active';
      })
      .map((p) => p.id as string),
  );

  const websites = websitesRes.data ?? [];
  const paidMonitoredWebsites = websites.filter((w) =>
    payingUserIds.has(w.user_id as string),
  ).length;

  const signups30d = signups30dRes.count ?? 0;
  const signupToPaid =
    signups30d > 0
      ? metric(
          Math.round((upgradedInWindow / signups30d) * 1000) / 10,
          'Signup → paid',
          true,
        )
      : metric(null, 'Signup → paid', signups30d === 0, {
          reason: 'No signups in the last 30 days.',
          source: 'profiles.created_at',
          action: 'Drive traffic to /signup and track conversion from funnel section.',
        });

  const scanToSignupEmpty = {
    reason: 'Requires linked scan sessions and signup attribution.',
    source: 'analytics_events + profiles',
    action: 'Ensure scan and signup events include session_id; review funnel drop-offs.',
  };

  const scanCompletions30d = await countAnalyticsEvents(['scan_completed'], thirtyDaysAgo);
  const scanToSignup =
    analyticsExists && scanCompletions30d > 0 && signups30d > 0
      ? metric(
          Math.round((signups30d / scanCompletions30d) * 1000) / 10,
          'Scan → signup',
          true,
        )
      : metric(null, 'Scan → signup', false, scanToSignupEmpty);

  const freeScanToPaid =
    analyticsExists && freeScans30d > 0 && upgradedInWindow > 0
      ? metric(
          Math.round((upgradedInWindow / freeScans30d) * 1000) / 10,
          'Free scan → paid',
          true,
        )
      : metric(null, 'Free scan → paid', false, {
          reason: 'Need anonymous scan events and paid conversions in the same window.',
          source: 'analytics_events (user_id null) + profiles',
          action: 'Track free scans on /scan; attribute checkout to scan session when possible.',
        });

  const analyticsEmpty = {
    reason: 'No analytics events recorded yet.',
    source: 'analytics_events table',
    action: 'Confirm /api/analytics/track fires on landing, scan, and pricing pages.',
  };

  return {
    generatedAt: now.toISOString(),
    totalUsers: profiles.length,
    signupsToday: signupsTodayRes.count ?? 0,
    signups7d: signups7dRes.count ?? 0,
    signups30d,
    totalWebsites: websitesRes.count ?? websites.length,
    totalScans: scansTotalRes.count ?? 0,
    freeScans30d: analyticsExists
      ? metric(freeScans30d, 'Free scans (30d)', true)
      : metric(null, 'Free scans (30d)', false, analyticsEmpty),
    loggedInScans30d: analyticsExists
      ? metric(loggedInScans30d, 'Logged-in scans (30d)', true)
      : metric(null, 'Logged-in scans (30d)', false, analyticsEmpty),
    paidMonitoredWebsites,
    subscriptionsByPlan,
    mrr: customerMetrics.mrr,
    arr: customerMetrics.arr,
    failedPayments,
    canceledSubscriptions,
    signupToPaidConversionPct: signupToPaid,
    scanToSignupConversionPct: scanToSignup,
    freeScanToPaidConversionPct: freeScanToPaid,
    emailsAlertsSent30d:
      alertsSent30d > 0
        ? metric(alertsSent30d, 'Emails/alerts sent (30d)', true)
        : metric(null, 'Emails/alerts sent (30d)', false, {
            reason: 'Alert/email send events not tracked in analytics_events.',
            source: 'Resend webhooks or explicit alert_sent events',
            action: 'Log alert_sent events when monitoring emails dispatch.',
          }),
    reportsViewed30d: analyticsExists
      ? metric(reportsViewed30d, 'Reports viewed (30d)', true)
      : metric(null, 'Reports viewed (30d)', false, analyticsEmpty),
    recentScans: (recentScansRes.data ?? []).map((s) => ({
      id: s.id as string,
      createdAt: s.created_at as string,
      score: typeof s.score === 'number' ? s.score : null,
      status: (s.status as string) ?? null,
    })),
  };
}

async function fetchFunnel(now: Date): Promise<FounderCommandCenterData['funnel']> {
  const since = daysAgo(FUNNEL_WINDOW_DAYS);
  const analyticsExists = await hasAnalyticsData();

  if (!analyticsExists) {
    return {
      generatedAt: now.toISOString(),
      windowDays: FUNNEL_WINDOW_DAYS,
      stages: [],
      pageViews30d: metric(null, 'Page views', false, {
        reason: 'No analytics events stored yet.',
        source: 'analytics_events',
        action: 'Verify client trackEvent() calls on marketing pages.',
      }),
      pricingPageViews30d: metric(null, 'Pricing views', false, {
        reason: 'No pricing_viewed or paywall_viewed events yet.',
        source: 'analytics_events',
        action: 'Add pricing_viewed tracking on /pricing and paywall surfaces.',
      }),
      signups30d: 0,
      analyticsAvailable: false,
      analyticsEmptyAction: 'Enable analytics on landing, scan, pricing, and checkout flows.',
    };
  }

  const events = await loadUnifiedEventsForWindow(since);
  const dropoffs = computeFunnelDropoffs(events, FUNNEL_WINDOW_DAYS);
  const stages = dropoffs.map((d) => ({
    stage: d.stage,
    label: STAGE_LABELS[d.stage] ?? d.stage,
    count: d.count,
    dropoffPct: d.dropoffPct,
  }));

  const [pageViews, pricingViews, signups30d] = await Promise.all([
    countAnalyticsEvents(['page_view', 'landing_view'], since),
    countAnalyticsEvents(['pricing_viewed', 'paywall_viewed'], since),
    createAdminClient()
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since.toISOString())
      .then((r) => r.count ?? 0),
  ]);

  return {
    generatedAt: now.toISOString(),
    windowDays: FUNNEL_WINDOW_DAYS,
    stages,
    pageViews30d: metric(pageViews, 'Page views', true),
    pricingPageViews30d: metric(pricingViews, 'Pricing views', true),
    signups30d,
    analyticsAvailable: true,
  };
}

async function fetchProduct(now: Date): Promise<FounderCommandCenterData['product']> {
  const admin = createAdminClient();
  const thirtyDaysAgo = daysAgo(30);

  const [websitesRes, scans30dRes, failedScansRes, scansRes, profilesRes, reportViews] =
    await Promise.all([
      admin.from('websites').select('id', { count: 'exact', head: true }),
      admin
        .from('scans')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo.toISOString()),
      admin
        .from('scans')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('created_at', thirtyDaysAgo.toISOString()),
      admin
        .from('scans')
        .select('id, score, issues, website_id, created_at, status')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(300),
      admin.from('profiles').select('id, email, plan, is_qa_account'),
      countAnalyticsEvents(['report_viewed'], thirtyDaysAgo),
    ]);

  const scans = scansRes.data ?? [];
  let scoreSum = 0;
  let scoreCount = 0;
  const severityCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();

  for (const scan of scans) {
    if (typeof scan.score === 'number') {
      scoreSum += scan.score;
      scoreCount++;
    }
    const issues = (scan.issues as Array<{ severity?: string; category?: string; title?: string }> | string[] | null) ?? [];
    for (const issue of issues) {
      if (typeof issue === 'string') {
        categoryCounts.set('general', (categoryCounts.get('general') ?? 0) + 1);
        continue;
      }
      const sev = (issue.severity ?? 'info').toLowerCase();
      severityCounts.set(sev, (severityCounts.get(sev) ?? 0) + 1);
      const cat = issue.category ?? issue.title?.slice(0, 40) ?? 'other';
      categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
    }
  }

  const profiles = (profilesRes.data ?? []).filter(
    (p) =>
      !isInternalCustomerProfile({
        email: (p.email as string) ?? '',
        is_qa_account: (p as { is_qa_account?: boolean }).is_qa_account ?? null,
        plan: (p.plan as string) ?? null,
      }),
  );

  const websiteCounts = new Map<string, number>();
  const { data: allWebsites } = await admin.from('websites').select('user_id');
  for (const w of allWebsites ?? []) {
    const uid = w.user_id as string;
    websiteCounts.set(uid, (websiteCounts.get(uid) ?? 0) + 1);
  }

  const scanCountsByUser = new Map<string, number>();
  const { data: scansWithSites } = await admin
    .from('scans')
    .select('website_id, websites(user_id)')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .limit(1000);

  for (const row of scansWithSites ?? []) {
    const sites = row.websites as { user_id?: string } | { user_id?: string }[] | null;
    const userId = Array.isArray(sites) ? sites[0]?.user_id : sites?.user_id;
    if (userId) scanCountsByUser.set(userId, (scanCountsByUser.get(userId) ?? 0) + 1);
  }

  const activeAccounts = profiles
    .filter((p) => (scanCountsByUser.get(p.id as string) ?? 0) > 0 || (websiteCounts.get(p.id as string) ?? 0) > 0)
    .map((p) => ({
      email: (p.email as string) ?? 'unknown',
      plan: (p.plan as string) ?? 'free',
      websites: websiteCounts.get(p.id as string) ?? 0,
      scans30d: scanCountsByUser.get(p.id as string) ?? 0,
    }))
    .sort((a, b) => b.scans30d - a.scans30d || b.websites - a.websites)
    .slice(0, 10);

  return {
    generatedAt: now.toISOString(),
    activeAccounts,
    monitoredWebsites: websitesRes.count ?? 0,
    scans30d: scans30dRes.count ?? 0,
    failedScans30d: failedScansRes.count ?? 0,
    websitesWithScoreChanges30d: metric(null, 'Score changes', false, {
      reason: 'Score change tracking across scans is not aggregated yet.',
      source: 'scans.score + website_id over time',
      action: 'Use dashboard change detection or add a nightly score-delta rollup.',
    }),
    websitesWithNewRisks30d: metric(null, 'New risks', false, {
      reason: 'New-risk rollup not implemented for founder view.',
      source: 'scan diff / alerts tables',
      action: 'Surface websites with new critical findings from monitoring alerts.',
    }),
    avgSecurityScore: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : null,
    findingsBySeverity: [...severityCounts.entries()]
      .map(([severity, count]) => ({ severity, count }))
      .sort((a, b) => b.count - a.count),
    topFindingCategories: [...categoryCounts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    reportViews30d: metric(reportViews, 'Report views', reportViews >= 0),
  };
}

async function fetchRevenue(now: Date): Promise<FounderCommandCenterData['revenue']> {
  const admin = createAdminClient();
  const customerMetrics = await getFounderCustomerMetrics();

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, plan, subscription_status, is_qa_account, email');

  const subscriptionsByPlan: Record<string, number> = {
    pro: 0,
    growth: 0,
    agency: 0,
    enterprise: 0,
  };
  let trialingUsers = 0;
  let freeUsers = 0;
  let canceledUsers = 0;
  let failedPayments = 0;

  for (const p of profiles ?? []) {
    if (
      isInternalCustomerProfile({
        email: (p.email as string) ?? '',
        is_qa_account: (p as { is_qa_account?: boolean }).is_qa_account ?? null,
        plan: (p.plan as string) ?? null,
      })
    ) {
      continue;
    }
    const plan = ((p.plan as string) ?? 'free').toLowerCase();
    const status = ((p.subscription_status as string) ?? '').toLowerCase();

    if (plan === 'free') freeUsers++;
    if (status === 'trialing') trialingUsers++;
    if (status === 'canceled' || status === 'cancelled') canceledUsers++;
    if (status === 'past_due' || status === 'unpaid') failedPayments++;
    if (plan in subscriptionsByPlan && status === 'active') subscriptionsByPlan[plan]++;
  }

  const costsRes = await admin
    .from('owner_founder_settings')
    .select('value')
    .eq('key', 'monthly_costs')
    .maybeSingle();

  let monthlyCosts: number | null = null;
  const costsConfigured =
    costsRes.data?.value != null &&
    typeof costsRes.data.value === 'object' &&
    'amount' in (costsRes.data.value as object);

  if (costsConfigured) {
    monthlyCosts = Number((costsRes.data!.value as { amount: number }).amount);
  }

  const mrr = customerMetrics.mrr;
  const netEstimate =
    monthlyCosts != null && monthlyCosts >= 0 ? mrr - monthlyCosts : null;

  return {
    generatedAt: now.toISOString(),
    mrr,
    arr: customerMetrics.arr,
    activePaidAccounts: customerMetrics.payingCustomers,
    subscriptionsByPlan,
    trialingUsers,
    freeUsers,
    canceledUsers,
    recentPayments: metric(null, 'Recent payments', false, {
      reason: 'Individual Stripe payment rows are not stored locally.',
      source: 'Stripe Dashboard → Payments',
      action: 'Review recent charges in Stripe; optionally sync payment intents to a founder table.',
    }),
    failedPayments,
    monthlyGrossRevenue: mrr,
    monthlyCosts,
    netEstimate,
    costsConfigured,
  };
}

function buildMarketingActions(): MarketingActionItem[] {
  return [
    {
      id: 'agency-prospects',
      title: 'Create 10 agency prospects',
      description: 'Add real agency contacts to CRM with verified emails — no auto-generated leads.',
      done: false,
    },
    {
      id: 'sample-reports',
      title: 'Run 10 sample reports',
      description: 'Use live scans on real sites to build case-study material and sales proof.',
      done: false,
    },
    {
      id: 'case-study',
      title: 'Post 1 case study',
      description: 'Publish one before/after security score story on /enterprise/case-studies.',
      done: false,
    },
    {
      id: 'pricing-page',
      title: 'Improve pricing page',
      description: 'Clarify Pro ($79), Growth ($149), and Agency ($299) value props.',
      done: false,
    },
    {
      id: 'testimonial',
      title: 'Add proof / testimonial',
      description: 'Collect one customer quote with permission for landing and pricing pages.',
      done: false,
    },
    {
      id: 'trial-followup',
      title: 'Follow up with trial users',
      description: 'Email trialing accounts within 48h of signup with setup help.',
      done: false,
    },
  ];
}

async function fetchMarketing(now: Date): Promise<FounderCommandCenterData['marketing']> {
  const admin = createAdminClient();
  const thirtyDaysAgo = daysAgo(30);

  const [
    draftsPendingRes,
    sent30dRes,
    campaignsRes,
    emailDeliveriesRes,
    scanPageViews,
    ctaClicks,
  ] = await Promise.all([
    admin
      .from('owner_outreach_drafts')
      .select('id', { count: 'exact', head: true })
      .in('status', ['draft', 'pending_approval'])
      .is('deleted_at', null),
    admin
      .from('owner_outreach_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'email_sent')
      .gte('created_at', thirtyDaysAgo.toISOString()),
    admin.from('owner_campaigns').select('id', { count: 'exact', head: true }),
    admin
      .from('owner_email_deliveries')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo.toISOString()),
    countEventByPathPrefix(['page_view'], '/scan', thirtyDaysAgo),
    countAnalyticsEvents(['upgrade_clicked'], thirtyDaysAgo),
  ]);

  return {
    generatedAt: now.toISOString(),
    outreachDraftsPending: draftsPendingRes.count ?? 0,
    outreachSent30d: sent30dRes.count ?? 0,
    campaignsCount: campaignsRes.count ?? 0,
    emailsSent30d: emailDeliveriesRes.count ?? 0,
    repliesTracked: metric(null, 'Replies', false, {
      reason: 'Reply tracking requires inbound email parsing or manual CRM updates.',
      source: 'owner_crm_leads status or Resend inbound',
      action: 'Mark leads as Replied in Sales / CRM when responses arrive.',
    }),
    freeScanPageViews30d: metric(scanPageViews, 'Free scan page views', true),
    ctaClicks30d: metric(ctaClicks, 'CTA clicks', true),
    actions: buildMarketingActions(),
    checklists: [
      {
        id: 'landing-seo',
        title: 'Landing & SEO checklist',
        items: [
          { label: 'Homepage meta title and description set', done: true },
          { label: 'Sitemap includes /scan and /pricing', done: true },
          { label: 'Free scan CTA above the fold on landing', done: false },
          { label: 'Structured data on pricing page', done: false },
        ],
      },
      {
        id: 'positioning',
        title: 'CyberShield positioning',
        items: [
          { label: 'Lead with monitoring + reports, not firewall claims', done: true },
          { label: 'Show 2-issue free preview limit clearly', done: true },
          { label: 'Agency plan mentions multi-site monitoring', done: false },
        ],
      },
    ],
  };
}

async function fetchSales(now: Date): Promise<FounderCommandCenterData['sales']> {
  const admin = createAdminClient();
  const { data: leads, error } = await admin
    .from('owner_crm_leads')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) {
    return {
      generatedAt: now.toISOString(),
      leads: [],
      stageCounts: {},
      crmAvailable: false,
    };
  }

  const stageCounts: Record<string, number> = {};
  const rows = (leads ?? []).map((l) => {
    const status = ((l.stage as string) ?? 'New').trim();
    stageCounts[status] = (stageCounts[status] ?? 0) + 1;
    return {
      id: l.id as string,
      name: (l.contact_name as string) ?? (l.business_name as string) ?? 'Unknown',
      company: (l.business_name as string) ?? null,
      status,
      source: (l.interest_source as string) ?? null,
      planOffered: null,
      nextFollowUp: (l.last_contact_at as string) ?? null,
      notes: (l.notes as string) ?? null,
      updatedAt: (l.updated_at as string) ?? now.toISOString(),
    };
  });

  return {
    generatedAt: now.toISOString(),
    leads: rows,
    stageCounts,
    crmAvailable: true,
  };
}

function buildSiteContentMap(now: Date): FounderCommandCenterData['siteContent'] {
  const entries: SiteContentEntry[] = [
    {
      key: 'hero-headline',
      label: 'Hero headline',
      location: 'components/landing/Hero.tsx',
      editable: false,
      note: 'Edit in code or add founder_site_settings table for live CMS.',
    },
    {
      key: 'hero-subhead',
      label: 'Hero subheadline',
      location: 'components/landing/Hero.tsx',
      editable: false,
      note: 'Paired with hero headline in landing component.',
    },
    {
      key: 'primary-cta',
      label: 'Primary CTA text',
      location: 'components/landing/Hero.tsx, app/scan/page.tsx',
      editable: false,
      note: 'Free scan CTA copy lives in landing and scan entry.',
    },
    {
      key: 'pricing',
      label: 'Pricing plan copy',
      location: 'app/pricing/page.tsx, lib/marketing/claims.ts',
      editable: false,
      note: 'Plan limits and prices must match Stripe and claims.ts.',
    },
    {
      key: 'faq',
      label: 'FAQ entries',
      location: 'components/landing/FAQ.tsx',
      editable: false,
      note: 'Keep answers aligned with implemented features.',
    },
    {
      key: 'trust-bar',
      label: 'Trust bar text',
      location: 'components/landing/TrustSignals.tsx',
      editable: false,
      note: 'Enterprise trust signals — no unverified stats.',
    },
    {
      key: 'announcement',
      label: 'Announcement / beta banner',
      location: 'Not implemented',
      editable: false,
      note: 'Add owner_founder_settings key announcement_banner when needed.',
    },
  ];

  return {
    generatedAt: now.toISOString(),
    entries,
    cmsAvailable: false,
  };
}

async function fetchOperations(now: Date): Promise<FounderCommandCenterData['operations']> {
  const admin = createAdminClient();
  const dayAgo = new Date(now.getTime() - MS_DAY);
  const threeDaysAgo = new Date(now.getTime() - 3 * MS_DAY);

  const alerts: FounderAlert[] = [];

  const [
    automationHealth,
    failedScansRes,
    failedDeliveriesRes,
    webhookRes,
    staleScanRes,
    analyticsExists,
  ] = await Promise.all([
    getAutomationHealth(),
    admin
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', dayAgo.toISOString()),
    admin
      .from('owner_email_deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', dayAgo.toISOString()),
    admin
      .from('stripe_webhook_events')
      .select('id', { count: 'exact', head: true })
      .gte('processed_at', dayAgo.toISOString()),
    admin.from('websites').select('id, user_id, updated_at').limit(500),
    hasAnalyticsData(),
  ]);

  for (const check of automationHealth.checks) {
    if (check.status === 'broken' || check.status === 'warning') {
      alerts.push({
        id: `auto-${check.id}`,
        severity: check.status === 'broken' ? 'critical' : 'warning',
        title: check.label,
        detail: check.detail,
        action: check.fixRecommendation ?? 'Review automation health.',
      });
    }
  }

  if ((failedScansRes.count ?? 0) > 0) {
    alerts.push({
      id: 'failed-scans',
      severity: 'warning',
      title: `${failedScansRes.count} failed scan(s) in 24h`,
      detail: 'Scans marked failed may indicate queue or target site issues.',
      action: 'Check /dashboard/admin/monitoring and scan queue logs.',
    });
  }

  if ((failedDeliveriesRes.count ?? 0) > 0) {
    alerts.push({
      id: 'email-failures',
      severity: 'warning',
      title: `${failedDeliveriesRes.count} email delivery failure(s) in 24h`,
      detail: 'Outreach or alert emails may not have reached recipients.',
      action: 'Review Resend dashboard and owner_email_deliveries.',
    });
  }

  if ((webhookRes.count ?? 0) === 0) {
    alerts.push({
      id: 'stripe-webhooks-quiet',
      severity: 'info',
      title: 'No Stripe webhooks processed in 24h',
      detail: 'Normal if no billing activity; verify webhook endpoint if subscriptions should have changed.',
      action: 'Check Stripe webhook logs and STRIPE_WEBHOOK_SECRET.',
    });
  }

  if (!analyticsExists) {
    alerts.push({
      id: 'analytics-empty',
      severity: 'warning',
      title: 'Analytics tracking has no events',
      detail: 'Funnel and marketing metrics cannot be calculated.',
      action: 'Verify trackEvent on landing, scan, pricing, and checkout pages.',
    });
  }

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, plan, subscription_status, email, is_qa_account')
    .in('plan', ['pro', 'growth', 'agency'])
    .eq('subscription_status', 'active');

  const paidProfiles = (profiles ?? []).filter(
    (p) =>
      !isInternalCustomerProfile({
        email: (p.email as string) ?? '',
        is_qa_account: (p as { is_qa_account?: boolean }).is_qa_account ?? null,
        plan: (p.plan as string) ?? null,
      }),
  );

  const { data: websites } = await admin.from('websites').select('user_id');
  const usersWithSites = new Set((websites ?? []).map((w) => w.user_id as string));
  const paidNoSites = paidProfiles.filter((p) => !usersWithSites.has(p.id as string)).length;

  if (paidNoSites > 0) {
    alerts.push({
      id: 'paid-no-websites',
      severity: 'warning',
      title: `${paidNoSites} paid account(s) with no websites`,
      detail: 'Customers may need onboarding help to add their first site.',
      action: 'Email affected accounts or review signup onboarding flow.',
    });
  }

  const staleThreshold = threeDaysAgo.toISOString();
  let staleMonitored = 0;
  for (const site of staleScanRes.data ?? []) {
    if (site.updated_at && (site.updated_at as string) < staleThreshold) staleMonitored++;
  }
  if (staleMonitored > 5) {
    alerts.push({
      id: 'stale-scans',
      severity: 'info',
      title: `${staleMonitored} websites not updated recently`,
      detail: 'Some monitored sites may not have recent scan activity.',
      action: 'Verify cron scan triggers and website monitoring cadence.',
    });
  }

  const overallStatus: FounderCommandCenterData['operations']['overallStatus'] = alerts.some(
    (a) => a.severity === 'critical',
  )
    ? 'critical'
    : alerts.some((a) => a.severity === 'warning')
      ? 'warning'
      : 'healthy';

  return {
    generatedAt: now.toISOString(),
    alerts,
    overallStatus,
  };
}

async function fetchDailyBrief(
  overview: FounderCommandCenterData['overview'],
  product: FounderCommandCenterData['product'],
  revenue: FounderCommandCenterData['revenue'],
): Promise<FounderDailyBrief> {
  const admin = createAdminClient();
  const dayAgo = new Date(Date.now() - MS_DAY);

  const [newUsersRes, newScansRes, newPaidRes, cancelsRes, highRiskRes, failedScans24hRes] =
    await Promise.all([
    admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', dayAgo.toISOString()),
    admin
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', dayAgo.toISOString()),
    admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', dayAgo.toISOString())
      .in('plan', ['pro', 'growth', 'agency'])
      .eq('subscription_status', 'active'),
    admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('updated_at', dayAgo.toISOString())
      .in('subscription_status', ['canceled', 'cancelled']),
    admin
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .lt('score', 50)
      .gte('created_at', dayAgo.toISOString()),
    admin
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', dayAgo.toISOString()),
  ]);

  const changes = [
    { label: 'New users', value: String(newUsersRes.count ?? 0) },
    { label: 'New scans', value: String(newScansRes.count ?? 0) },
    { label: 'New paid subscriptions', value: String(newPaidRes.count ?? 0) },
    { label: 'Failed scans (24h)', value: String(failedScans24hRes.count ?? 0) },
    { label: 'Cancellations (24h)', value: String(cancelsRes.count ?? 0) },
    { label: 'Low score scans (<50)', value: String(highRiskRes.count ?? 0) },
    { label: 'MRR', value: `$${revenue.mrr.toLocaleString()}` },
  ];

  const suggestedActions: FounderDailyBrief['suggestedActions'] = [];

  if ((newUsersRes.count ?? 0) > 0 && overview.paidMonitoredWebsites === 0) {
    suggestedActions.push({
      title: 'Help new users add a website',
      detail: 'New signups without websites cannot experience monitoring value.',
      section: 'product',
    });
  }
  if (product.failedScans30d > 0) {
    suggestedActions.push({
      title: 'Review failed scans',
      detail: `${product.failedScans30d} failed scans in the last 30 days — check queue health.`,
      section: 'alerts',
    });
  }
  if (revenue.failedPayments > 0) {
    suggestedActions.push({
      title: 'Address failed payments',
      detail: `${revenue.failedPayments} account(s) past due or unpaid.`,
      section: 'revenue',
    });
  }
  if (suggestedActions.length === 0) {
    suggestedActions.push({
      title: 'Review funnel drop-offs',
      detail: 'Check Traffic & Funnel for stages losing the most sessions.',
      section: 'funnel',
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    windowHours: 24,
    changes,
    suggestedActions,
  };
}

export async function getFounderCommandCenter(): Promise<FounderCommandCenterData> {
  try {
    const now = new Date();
    const overview = await fetchOverview(now);
    const [funnel, product, revenue, marketing, sales, operations] = await Promise.all([
      fetchFunnel(now),
      fetchProduct(now),
      fetchRevenue(now),
      fetchMarketing(now),
      fetchSales(now),
      fetchOperations(now),
    ]);
    const siteContent = buildSiteContentMap(now);
    const dailyBrief = await fetchDailyBrief(overview, product, revenue);

    return {
      generatedAt: now.toISOString(),
      overview,
      funnel,
      product,
      revenue,
      marketing,
      sales,
      siteContent,
      operations,
      dailyBrief,
    };
  } catch (err) {
    console.error('[getFounderCommandCenter]', err);
    return { ...EMPTY_FOUNDER_COMMAND_CENTER, generatedAt: new Date().toISOString() };
  }
}

export { EMPTY_FOUNDER_COMMAND_CENTER };
