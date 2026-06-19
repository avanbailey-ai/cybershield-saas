import type { SupabaseClient } from '@supabase/supabase-js';
import { runProspectDiscovery, scanPendingProspects } from './discovery/engine';
import { runAutoArchive } from './autoArchive';
import { runStaleDataHygiene } from './staleDataHygiene';
import { markDueFollowUps } from './followUpScheduler';
import { reconcilePaidConversions } from './prospectAttribution';
import { ensureOutreachDraft } from './ensureOutreachDraft';
import { evaluateDeliverabilityGuard } from './deliverabilityGuard';
import {
  getGrowthAutopilotSettings,
  type GrowthAutopilotSettings,
} from './growthAutopilotSettings';
import { getOutreachSettings } from './outreachSettings';
import type { FounderSectionId } from './founderNav';

export interface OvernightGrowthReport {
  generatedAt: string;
  periodHours: number;
  prospectsDiscovered: number;
  prospectsScanned: number;
  contactsFound: number;
  draftsCreated: number;
  emailsSent: number;
  opens: number;
  clicks: number;
  replies: number;
  signups: number;
  followUpsDue: number;
  failedActions: number;
  blockedItems: number;
  idleReasons: string[];
  summaryLine: string;
}

export interface GrowthAutopilotStageStatus {
  id: string;
  label: string;
  enabled: boolean;
  detail: string;
}

export interface MoneyMove {
  id: string;
  title: string;
  why: string;
  estimatedMrr: number | null;
  confidence: 'high' | 'medium' | 'low';
  action: string;
  section: FounderSectionId;
  blockedReason: string | null;
}

export interface RevenuePipelineSnapshot {
  smbProspects: number;
  agencyProspects: number;
  contacted: number;
  clicked: number;
  signedUp: number;
  paid: number;
  mrr: number;
  conversionRate: number;
}

export interface GrowthAutopilotSnapshot {
  mode: GrowthAutopilotSettings['mode'];
  prepareOnly: boolean;
  deliverabilityStatus: 'healthy' | 'caution' | 'paused';
  deliverabilityReasons: string[];
  recommendedDailyCap: number;
  sendsToday: number;
  stages: GrowthAutopilotStageStatus[];
  overnight: OvernightGrowthReport;
  moneyMoves: MoneyMove[];
  pipeline: RevenuePipelineSnapshot;
  lastCronAt: string | null;
}

export interface GrowthAutopilotRunResult {
  ok: boolean;
  prepareOnly: boolean;
  mode: GrowthAutopilotSettings['mode'];
  deliverabilityPaused: boolean;
  discovery: Record<string, unknown>;
  scanned: number;
  draftsCreated: number;
  followUpsDue: number;
  blockedReasons: string[];
  overnight: OvernightGrowthReport;
}

const LAST_RUN_KEY = 'growth_autopilot_last_run';
const OVERNIGHT_KEY = 'growth_autopilot_overnight';

async function countSince(
  admin: SupabaseClient,
  table: string,
  since: string,
): Promise<number> {
  const { count } = await admin
    .from(table)
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since);
  return count ?? 0;
}

async function buildOvernightReport(
  admin: SupabaseClient,
  hours = 24,
  runStats?: Partial<OvernightGrowthReport>,
): Promise<OvernightGrowthReport> {
  const since = new Date(Date.now() - hours * 3600000).toISOString();
  const settings = await getGrowthAutopilotSettings(admin);
  const outreach = await getOutreachSettings(admin);
  const guard = await evaluateDeliverabilityGuard(admin, {
    warmupWeek: settings.warmup_week,
    mode: settings.mode,
  });

  const [
    prospectsDiscovered,
    prospectsScanned,
    contactsFound,
    draftsCreated,
    emailsSent,
    opens,
    clicks,
    replies,
    signups,
    followUpsDue,
    failedActions,
  ] = await Promise.all([
    countSince(admin, 'owner_prospects', since),
    admin
      .from('owner_prospects')
      .select('id', { count: 'exact', head: true })
      .eq('scan_status', 'completed')
      .gte('updated_at', since)
      .then((r) => r.count ?? 0),
    admin
      .from('owner_outreach_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'contact_found')
      .gte('created_at', since)
      .then((r) => r.count ?? 0),
    countSince(admin, 'owner_outreach_drafts', since),
    admin
      .from('owner_outreach_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'email_sent')
      .gte('created_at', since)
      .then((r) => r.count ?? 0),
    admin
      .from('owner_email_engagement_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'opened')
      .gte('created_at', since)
      .then((r) => r.count ?? 0),
    admin
      .from('owner_email_engagement_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'clicked')
      .gte('created_at', since)
      .then((r) => r.count ?? 0),
    admin
      .from('owner_email_engagement_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'replied')
      .gte('created_at', since)
      .then((r) => r.count ?? 0),
    admin
      .from('owner_outreach_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'prospect_signup')
      .gte('created_at', since)
      .then((r) => r.count ?? 0),
    admin
      .from('owner_follow_ups')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'due')
      .then((r) => r.count ?? 0),
    admin
      .from('owner_outreach_drafts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .is('deleted_at', null)
      .then((r) => r.count ?? 0),
  ]);

  const idleReasons: string[] = [];
  if (!settings.discovery_enabled) idleReasons.push('Discovery disabled in autopilot settings');
  if (guard.status === 'paused') idleReasons.push(...guard.reasons);
  if (!outreach.enable_outreach_sending) idleReasons.push('Outreach sending paused in settings');
  if (outreach.require_approval) idleReasons.push('Manual approval required before any send');
  if (settings.mode === 'manual' || settings.mode === 'assisted') {
    idleReasons.push('Autopilot prepare-only — sends need your approval');
  }

  const report: OvernightGrowthReport = {
    generatedAt: new Date().toISOString(),
    periodHours: hours,
    prospectsDiscovered: runStats?.prospectsDiscovered ?? prospectsDiscovered,
    prospectsScanned: runStats?.prospectsScanned ?? prospectsScanned,
    contactsFound: runStats?.contactsFound ?? contactsFound,
    draftsCreated: runStats?.draftsCreated ?? draftsCreated,
    emailsSent: runStats?.emailsSent ?? emailsSent,
    opens: runStats?.opens ?? opens,
    clicks: runStats?.clicks ?? clicks,
    replies: runStats?.replies ?? replies,
    signups: runStats?.signups ?? signups,
    followUpsDue: runStats?.followUpsDue ?? followUpsDue,
    failedActions: runStats?.failedActions ?? failedActions,
    blockedItems: guard.reasons.length,
    idleReasons: [...new Set(idleReasons)],
    summaryLine: '',
  };

  const activity =
    report.prospectsDiscovered +
    report.prospectsScanned +
    report.draftsCreated +
    report.emailsSent;

  if (activity === 0) {
    report.summaryLine =
      idleReasons[0] ?? 'No overnight activity — run discovery or check cron schedule.';
  } else {
    report.summaryLine = [
      report.prospectsDiscovered > 0 ? `${report.prospectsDiscovered} prospect(s) added` : null,
      report.draftsCreated > 0 ? `${report.draftsCreated} draft(s) ready` : null,
      report.followUpsDue > 0 ? `${report.followUpsDue} follow-up(s) due` : null,
      report.emailsSent > 0 ? `${report.emailsSent} email(s) sent` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  return report;
}

async function saveOvernightReport(admin: SupabaseClient, report: OvernightGrowthReport) {
  await admin.from('owner_founder_settings').upsert({
    key: OVERNIGHT_KEY,
    value: report,
    updated_at: new Date().toISOString(),
  });
}

export async function loadOvernightReport(admin: SupabaseClient): Promise<OvernightGrowthReport | null> {
  const { data } = await admin
    .from('owner_founder_settings')
    .select('value')
    .eq('key', OVERNIGHT_KEY)
    .maybeSingle();
  return (data?.value as OvernightGrowthReport) ?? null;
}

async function autoDraftQualifiedProspects(admin: SupabaseClient, limit = 10): Promise<number> {
  const { data: prospects } = await admin
    .from('owner_prospects')
    .select('*')
    .in('pipeline_state', ['outreach_ready', 'qualified'])
    .eq('scan_status', 'completed')
    .not('contact_email', 'is', null)
    .is('deleted_at', null)
    .limit(limit);

  let created = 0;
  for (const p of prospects ?? []) {
    const result = await ensureOutreachDraft(admin, p);
    if (result.created) created++;
  }
  return created;
}

/** Nightly growth autopilot — prepare-only by default; never auto-sends unless limited mode + guard pass. */
export async function runGrowthAutopilot(admin: SupabaseClient): Promise<GrowthAutopilotRunResult> {
  const settings = await getGrowthAutopilotSettings(admin);
  const guard = await evaluateDeliverabilityGuard(admin, {
    warmupWeek: settings.warmup_week,
    mode: settings.mode,
  });

  const blockedReasons = [...guard.reasons];
  const prepareOnly = settings.prepare_only || settings.mode !== 'limited' || !settings.limited_autopilot_sending;
  const deliverabilityPaused = guard.status === 'paused' || settings.mode === 'paused';

  let discovery: Record<string, unknown> = { skipped: true };
  let scanned = 0;
  let draftsCreated = 0;
  let followUpsDue = 0;

  if (settings.discovery_enabled && !deliverabilityPaused) {
    const discoveryResult = await runProspectDiscovery({ autoScan: settings.scanning_enabled });
    discovery = { ...discoveryResult };
    if (settings.scanning_enabled) {
      scanned = (discovery.scanned as number) ?? 0;
      scanned += await scanPendingProspects(10);
    }
  } else if (settings.scanning_enabled) {
    scanned = await scanPendingProspects(10);
  }

  if (settings.draft_generation_enabled) {
    draftsCreated = await autoDraftQualifiedProspects(admin, 15);
  }

  await runAutoArchive(admin);
  await runStaleDataHygiene(admin);

  if (settings.follow_ups_enabled) {
    followUpsDue = await markDueFollowUps(admin);
  }

  await reconcilePaidConversions(admin);

  // Limited autopilot sending is explicitly opt-in — never runs by default
  if (
    !prepareOnly &&
    settings.mode === 'limited' &&
    settings.limited_autopilot_sending &&
    guard.canLimitedAutopilot
  ) {
    blockedReasons.push('Limited autopilot send path exists but is disabled in this sprint — manual approval only');
  }

  const overnight = await buildOvernightReport(admin, 24, {
    prospectsDiscovered: (discovery.inserted as number) ?? 0,
    prospectsScanned: scanned,
    draftsCreated,
    followUpsDue,
  });

  await saveOvernightReport(admin, overnight);
  await admin.from('owner_founder_settings').upsert({
    key: LAST_RUN_KEY,
    value: { ranAt: new Date().toISOString(), prepareOnly, mode: settings.mode, overnight },
    updated_at: new Date().toISOString(),
  });

  return {
    ok: true,
    prepareOnly,
    mode: settings.mode,
    deliverabilityPaused,
    discovery,
    scanned,
    draftsCreated,
    followUpsDue,
    blockedReasons,
    overnight,
  };
}

export async function buildGrowthAutopilotSnapshot(
  admin: SupabaseClient,
  input: {
    pendingApprovals: number;
    followUpsDue: number;
    mrr: number;
    payingCustomers: number;
    smbCount: number;
    agencyCount: number;
    contactedCount: number;
    inboxTopItems: Array<{
      id: string;
      title: string;
      why: string;
      revenueImpact: number | null;
      section: FounderSectionId;
    }>;
  },
): Promise<GrowthAutopilotSnapshot> {
  const settings = await getGrowthAutopilotSettings(admin);
  const guard = await evaluateDeliverabilityGuard(admin, {
    warmupWeek: settings.warmup_week,
    mode: settings.mode,
  });
  const overnight =
    (await loadOvernightReport(admin)) ?? (await buildOvernightReport(admin, 24));

  const { data: lastRun } = await admin
    .from('owner_founder_settings')
    .select('value')
    .eq('key', LAST_RUN_KEY)
    .maybeSingle();

  const sendingMode =
    settings.mode === 'paused'
      ? 'paused'
      : settings.mode === 'limited' && settings.limited_autopilot_sending
        ? 'limited autopilot'
        : settings.mode === 'assisted'
          ? 'assisted (bulk approve)'
          : 'manual approval';

  const stages: GrowthAutopilotStageStatus[] = [
    {
      id: 'discovery',
      label: 'Discovery',
      enabled: settings.discovery_enabled,
      detail: settings.discovery_enabled ? 'On — nightly cron' : 'Off',
    },
    {
      id: 'scanning',
      label: 'Scanning',
      enabled: settings.scanning_enabled,
      detail: settings.scanning_enabled ? 'On — auto-scan after discovery' : 'Off',
    },
    {
      id: 'contacts',
      label: 'Contact finding',
      enabled: settings.contact_finding_enabled,
      detail: settings.contact_finding_enabled ? 'On — during scan/enrichment' : 'Off',
    },
    {
      id: 'drafts',
      label: 'Draft generation',
      enabled: settings.draft_generation_enabled,
      detail: settings.draft_generation_enabled ? 'On — drafts queued for approval' : 'Off',
    },
    {
      id: 'sending',
      label: 'Sending',
      enabled: settings.mode !== 'paused',
      detail: sendingMode,
    },
    {
      id: 'followups',
      label: 'Follow-ups',
      enabled: settings.follow_ups_enabled,
      detail: settings.follow_ups_enabled ? 'On — manual approval by default' : 'Off',
    },
    {
      id: 'deliverability',
      label: 'Deliverability protection',
      enabled: true,
      detail: `${guard.status} — cap ${guard.recommendedDailyCap}/day`,
    },
  ];

  const moneyMoves: MoneyMove[] = input.inboxTopItems.slice(0, 3).map((item) => ({
    id: item.id,
    title: item.title,
    why: item.why,
    estimatedMrr: item.revenueImpact,
    confidence: item.revenueImpact && item.revenueImpact >= 149 ? 'high' : 'medium',
    action: 'Review in inbox',
    section: item.section,
    blockedReason: guard.status === 'paused' ? guard.reasons[0] ?? 'Deliverability paused' : null,
  }));

  if (moneyMoves.length === 0 && input.pendingApprovals === 0) {
    moneyMoves.push({
      id: 'run-discovery',
      title: 'Run prospect discovery',
      why: 'Pipeline is quiet — add qualified prospects to the top of funnel.',
      estimatedMrr: null,
      confidence: 'medium',
      action: 'Open prospects',
      section: 'prospects',
      blockedReason: null,
    });
  }

  const { count: clicked } = await admin
    .from('owner_prospect_attributions')
    .select('id', { count: 'exact', head: true })
    .not('clicked_at', 'is', null);

  const { count: signedUp } = await admin
    .from('owner_prospect_attributions')
    .select('id', { count: 'exact', head: true })
    .not('signed_up_at', 'is', null);

  const { count: paid } = await admin
    .from('owner_prospect_attributions')
    .select('id', { count: 'exact', head: true })
    .not('converted_at', 'is', null);

  const pipeline: RevenuePipelineSnapshot = {
    smbProspects: input.smbCount,
    agencyProspects: input.agencyCount,
    contacted: input.contactedCount,
    clicked: clicked ?? 0,
    signedUp: signedUp ?? 0,
    paid: paid ?? 0,
    mrr: input.mrr,
    conversionRate:
      input.contactedCount > 0 ? Math.round(((paid ?? 0) / input.contactedCount) * 1000) / 10 : 0,
  };

  return {
    mode: settings.mode,
    prepareOnly: settings.prepare_only,
    deliverabilityStatus: guard.status,
    deliverabilityReasons: guard.reasons,
    recommendedDailyCap: guard.recommendedDailyCap,
    sendsToday: guard.sendsToday,
    stages,
    overnight,
    moneyMoves,
    pipeline,
    lastCronAt: (lastRun?.value as { ranAt?: string })?.ranAt ?? null,
  };
}
