/**
 * Product QA invariants verification (code-level, CYBERSHIELD).
 *
 * This is a STRUCTURAL, read-only audit. It proves the production-safety
 * invariants for the merged "agency prospect discovery & outreach" system and
 * the surrounding product by reading source files / routes / components and
 * running a few light pure functions. It NEVER sends email, never touches the
 * network, never mutates data.
 *
 * Each invariant is reported as one of:
 *   - PASS          : statically (or with a light pure-function check) proven
 *   - FAIL          : invariant violated  -> non-zero exit
 *   - MANUAL-REVIEW : cannot be proven from code alone (does NOT fail the run,
 *                     but is surfaced loudly so a human verifies it live)
 *
 * Invariants checked:
 *   1.  Founder OS routes are owner-only (every app/api/owner/** route + owner
 *       page/layout guarded; middleware gates owner UI as defense-in-depth).
 *   2.  Customer-facing navigation does NOT expose Founder OS.
 *   3.  Outreach requires manual approval — no auto-send path.
 *   4.  Follow-up dedupe still exists (idempotency + no-cascade + DB index).
 *   5.  Agency/SMB separation exists (prospect_kind + separate generators).
 *   6.  NOT AGENCY FIT does not enter the agency pipeline.
 *   7.  Internal / QA accounts excluded from founder metrics.
 *   8.  Free plan copy does not promise paid (continuous) monitoring.
 *   9.  Email health uses the verified root sender (no unverified subdomain).
 *   10. Pricing tiers match the current model (Pro 79 / Growth 149 / Agency 299
 *       / Enterprise present).
 *   11. Mobile-critical pages exist as routes.
 *
 * Run: npx tsx scripts/verify-product-qa-invariants.ts
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { decideProspectKind } from '../lib/owner/agency/agencyScore';

// ── result tracking ──────────────────────────────────────────────────────────
type Status = 'PASS' | 'FAIL' | 'MANUAL';
interface CheckResult {
  group: string;
  status: Status;
  message: string;
}

const results: CheckResult[] = [];

function record(group: string, status: Status, message: string): void {
  results.push({ group, status, message });
  const tag = status === 'PASS' ? 'PASS' : status === 'FAIL' ? 'FAIL' : 'MANUAL-REVIEW';
  const line = `  [${tag}] ${message}`;
  if (status === 'FAIL') console.error(line);
  else console.log(line);
}

function pass(group: string, message: string): void {
  record(group, 'PASS', message);
}
function fail(group: string, message: string): void {
  record(group, 'FAIL', message);
}
function manual(group: string, message: string): void {
  record(group, 'MANUAL', message);
}

/** PASS when condition is true, otherwise FAIL. */
function check(group: string, condition: boolean, message: string): boolean {
  if (condition) pass(group, message);
  else fail(group, message);
  return condition;
}

// ── fs helpers ───────────────────────────────────────────────────────────────
function read(rel: string): string {
  const p = join(process.cwd(), rel);
  if (!existsSync(p)) return '';
  return readFileSync(p, 'utf8');
}

function fileExists(rel: string): boolean {
  return existsSync(join(process.cwd(), rel));
}

function listFiles(dir: string, filename: string): string[] {
  const full = join(process.cwd(), dir);
  if (!existsSync(full)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(full, { withFileTypes: true })) {
    const rel = join(dir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) out.push(...listFiles(rel, filename));
    else if (entry.name === filename) out.push(rel);
  }
  return out;
}

function sqlMigrations(): string[] {
  const migDir = 'supabase/migrations';
  if (!fileExists(migDir)) return [];
  return readdirSync(join(process.cwd(), migDir))
    .filter((f) => f.endsWith('.sql'))
    .map((f) => read(join(migDir, f)));
}

console.log('CyberShield product QA invariants verification\n');

// ─────────────────────────────────────────────────────────────────────────────
// 1. Founder OS routes are owner-only
// ─────────────────────────────────────────────────────────────────────────────
const G1 = '1. Founder OS owner-only';
console.log(`\n${G1}`);

const OWNER_GUARD =
  /requireOwner\s*\(|isOwner\s*\(|from\s+['"]@\/lib\/auth\/owner['"]|from\s+['"]@\/lib\/owner\/requireOwner['"]/;

const ownerApiRoutes = listFiles('app/api/owner', 'route.ts');
check(G1, ownerApiRoutes.length >= 30, `found ${ownerApiRoutes.length} /api/owner/* route files (expected 30+)`);

const unguardedOwnerApis = ownerApiRoutes.filter((r) => !OWNER_GUARD.test(read(r)));
check(
  G1,
  unguardedOwnerApis.length === 0,
  unguardedOwnerApis.length === 0
    ? `all ${ownerApiRoutes.length} /api/owner/* routes call requireOwner/isOwner`
    : `owner API routes missing an owner guard: ${unguardedOwnerApis.join(', ')}`,
);

// admin API routes are owner-gated too
const adminApiRoutes = listFiles('app/api/admin', 'route.ts');
const unguardedAdminApis = adminApiRoutes.filter((r) => !OWNER_GUARD.test(read(r)));
check(
  G1,
  adminApiRoutes.length > 0 && unguardedAdminApis.length === 0,
  unguardedAdminApis.length === 0
    ? `all ${adminApiRoutes.length} /api/admin/* routes call requireOwner/isOwner`
    : `admin API routes missing an owner guard: ${unguardedAdminApis.join(', ')}`,
);

// owner UI layout + page guards
const ownerLayout = read('app/dashboard/admin/owner/layout.tsx');
check(
  G1,
  /isOwner\s*\(/.test(ownerLayout) && /redirect\(['"]\/login['"]\)/.test(ownerLayout),
  'Founder OS layout (app/dashboard/admin/owner/layout.tsx) redirects non-owners to /login',
);
const ownerPage = read('app/dashboard/admin/owner/page.tsx');
check(
  G1,
  /isOwner\s*\(/.test(ownerPage) && /redirect\(/.test(ownerPage),
  'Founder OS page (app/dashboard/admin/owner/page.tsx) re-checks isOwner and redirects',
);

// admin pages enforce isOwner
const adminPages = listFiles('app/dashboard/admin', 'page.tsx');
const unguardedAdminPages = adminPages.filter((p) => !/isOwner\s*\(/.test(read(p)));
check(
  G1,
  adminPages.length > 0 && unguardedAdminPages.length === 0,
  unguardedAdminPages.length === 0
    ? `all ${adminPages.length} /dashboard/admin pages enforce isOwner`
    : `admin pages missing isOwner gate: ${unguardedAdminPages.join(', ')}`,
);

// middleware defense-in-depth gates owner UI + APIs
const middleware = read('lib/supabase/middleware.ts');
check(
  G1,
  /isOwnerOnlyPath\s*\(/.test(middleware) &&
    /'\/dashboard\/admin'/.test(middleware) &&
    /'\/api\/owner'/.test(middleware) &&
    /'\/api\/admin'/.test(middleware) &&
    /!isOwner\(user\.email\)/.test(middleware),
  'middleware defines isOwnerOnlyPath and denies non-owners on /dashboard/admin, /api/owner, /api/admin',
);

// no phantom unguarded owner page trees
const phantomDirs = ['app/founder', 'app/owner', 'app/dashboard/owner'].filter((d) => fileExists(d));
check(
  G1,
  phantomDirs.length === 0,
  phantomDirs.length === 0
    ? 'no phantom /founder, /owner, /dashboard/owner page trees on disk'
    : `phantom owner route dirs present: ${phantomDirs.join(', ')}`,
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. Customer-facing navigation does NOT expose Founder OS
// ─────────────────────────────────────────────────────────────────────────────
const G2 = '2. Customer nav hides Founder OS';
console.log(`\n${G2}`);

const FORBIDDEN_NAV = /\/dashboard\/admin\/owner|\/founder\b|\/owner\b|prospect|agency-discovery/i;
const customerNavFiles = [
  'components/landing/Navbar.tsx',
  'components/landing/Footer.tsx',
  'components/dashboard/DashboardSidebar.tsx',
  'components/dashboard/DashboardShell.tsx',
  'components/enterprise/EnterprisePortalShell.tsx',
];
for (const navRel of customerNavFiles) {
  if (!fileExists(navRel)) {
    manual(G2, `nav file not found (skipped): ${navRel}`);
    continue;
  }
  const src = read(navRel);
  check(
    G2,
    !FORBIDDEN_NAV.test(src),
    `${navRel} contains no Founder OS / prospect / agency-discovery links`,
  );
}

// the customer dashboard layout must short-circuit owners (so owner-only nav is
// never assembled for normal customers) and gate the Admin entry on the flag
const dashLayout = read('app/dashboard/layout.tsx');
check(
  G2,
  /if\s*\(owner\)/.test(dashLayout) && /showAdmin=\{owner\}/.test(dashLayout),
  'customer dashboard layout short-circuits owners and gates the Admin nav entry on the owner flag',
);

// sitemap / robots must not advertise Founder OS
if (fileExists('app/sitemap.ts')) {
  check(
    G2,
    !read('app/sitemap.ts').includes('/dashboard/admin'),
    'sitemap.ts does not list /dashboard/admin (Founder OS)',
  );
} else {
  manual(G2, 'app/sitemap.ts not found — confirm Founder OS is not in any sitemap');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Outreach requires manual approval — no auto-send path
// ─────────────────────────────────────────────────────────────────────────────
const G3 = '3. Manual approval / no auto-send';
console.log(`\n${G3}`);

const execSrc = read('lib/owner/outreachExecution.ts');
check(
  G3,
  /settings\.require_approval\s*&&\s*options\.approved\s*!==\s*true/.test(execSrc) &&
    /Approval required before send/.test(execSrc),
  'sendApprovedOutreach blocks sends without approved=true when require_approval is set',
);

const sendRoute = read('app/api/owner/outreach/[id]/send/route.ts');
check(
  G3,
  /requireOwner\s*\(/.test(sendRoute) &&
    /sendApprovedOutreach\(\s*admin,\s*id,\s*\{\s*approved:\s*true\s*\}\s*\)/.test(sendRoute),
  'the owner send route passes approved:true and is owner-gated (requireOwner)',
);

// gather all .ts/.tsx under app + lib that reference a needle
function grepRefs(dirs: string[], needle: string): string[] {
  const hits: string[] = [];
  const walk = (dir: string) => {
    const full = join(process.cwd(), dir);
    if (!existsSync(full)) return;
    for (const entry of readdirSync(full, { withFileTypes: true })) {
      const rel = join(dir, entry.name).replace(/\\/g, '/');
      if (entry.isDirectory()) walk(rel);
      else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        if (read(rel).includes(needle)) hits.push(rel);
      }
    }
  };
  for (const d of dirs) walk(d);
  return hits;
}

// sendApprovedOutreach must only be reachable from KNOWN owner-gated approval
// surfaces: its own module, the explicit send route, and the Founder OS inbox
// "approve" action (inboxAutomation.ts, reached only via the owner inbox route).
const ALLOWED_SEND_CALLERS = new Set([
  'lib/owner/outreachExecution.ts', // the definition
  'app/api/owner/outreach/[id]/send/route.ts', // explicit owner send
  'lib/owner/inboxAutomation.ts', // owner inbox approve action
]);
const sendApprovedRefs = grepRefs(['app', 'lib'], 'sendApprovedOutreach').filter(
  (f) => !ALLOWED_SEND_CALLERS.has(f),
);
check(
  G3,
  sendApprovedRefs.length === 0,
  sendApprovedRefs.length === 0
    ? 'sendApprovedOutreach is reachable only from owner-gated approval surfaces (send route + inbox approve)'
    : `unexpected sendApprovedOutreach callers: ${sendApprovedRefs.join(', ')}`,
);

// The inbox approval surface must itself be owner-gated and require an explicit
// approve action (not auto-fired). It is the second legitimate human-approval path.
const inboxRoute = read('app/api/owner/inbox/route.ts');
check(
  G3,
  /requireOwner\s*\(/.test(inboxRoute) &&
    /action === 'approve'/.test(inboxRoute) &&
    /executeInboxApproval\(/.test(inboxRoute),
  'inbox approval route is owner-gated and only calls executeInboxApproval on an explicit approve action',
);

// No background / cron job may auto-send outreach (the human stays in the loop).
const cronAutoSend = grepRefs(['app/api/cron'], 'sendApprovedOutreach').concat(
  grepRefs(['app/api/cron'], 'executeInboxApproval'),
);
check(
  G3,
  cronAutoSend.length === 0,
  cronAutoSend.length === 0
    ? 'no cron/background route calls sendApprovedOutreach or executeInboxApproval (no auto-send)'
    : `cron routes auto-send outreach: ${cronAutoSend.join(', ')}`,
);

// draft-creation / classification / regenerate / discovery paths never send
const NO_SEND = /sendApprovedOutreach|sendEmail\s*\(/;
const noSendFiles = [
  'lib/owner/ensureOutreachDraft.ts',
  'lib/owner/agency/agencyDraft.ts',
  'lib/owner/agency/agencyEnrichment.ts',
  'lib/owner/discovery/engine.ts',
  'app/api/owner/prospects/bulk/route.ts',
  'app/api/owner/outreach/[id]/regenerate/route.ts',
];
for (const rel of noSendFiles) {
  check(
    G3,
    fileExists(rel) && !NO_SEND.test(read(rel)),
    `${rel} creates/updates drafts but never auto-sends`,
  );
}

const ensureSrc = read('lib/owner/ensureOutreachDraft.ts');
check(
  G3,
  /status:\s*'draft'/.test(ensureSrc),
  'ensureOutreachDraft inserts outreach with status=draft (never status=sent)',
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. Follow-up dedupe still exists
// ─────────────────────────────────────────────────────────────────────────────
const G4 = '4. Follow-up dedupe';
console.log(`\n${G4}`);

const schedulerSrc = read('lib/owner/followUpScheduler.ts');
check(
  G4,
  /existingStages/.test(schedulerSrc) &&
    /existingStages\.has\(/.test(schedulerSrc) &&
    /continue/.test(schedulerSrc),
  'followUpScheduler.ts is idempotent (skips stages with an existing active follow-up)',
);
check(
  G4,
  /if\s*\(draft\.outreach_type\s*!==\s*'follow_up'\)[\s\S]{0,200}scheduleFollowUps/.test(execSrc),
  "outreachExecution.ts only seeds follow-ups when outreach_type !== 'follow_up' (no cascade)",
);
const hasFollowUpIndex = sqlMigrations().some((sql) =>
  /uniq_owner_follow_ups_active_stage/.test(sql) && /follow_up_number/.test(sql),
);
check(G4, hasFollowUpIndex, 'a migration defines the partial unique index uniq_owner_follow_ups_active_stage');

// ─────────────────────────────────────────────────────────────────────────────
// 5. Agency / SMB separation exists
// ─────────────────────────────────────────────────────────────────────────────
const G5 = '5. Agency / SMB separation';
console.log(`\n${G5}`);

const draftBridge = read('lib/owner/agency/agencyDraft.ts');
check(
  G5,
  /prospect_kind/.test(draftBridge) && /=== 'agency'/.test(draftBridge),
  'agencyDraft.ts isAgencyProspect keys off prospect_kind === "agency"',
);
check(
  G5,
  /isAgencyProspect\(prospect\)/.test(ensureSrc) &&
    /buildAgencyDraftContent\(prospect\)/.test(ensureSrc) &&
    /generateOutreach\('cold_email'/.test(ensureSrc),
  'ensureOutreachDraft routes agency prospects to the agency generator and SMB to the SMB generator',
);
const hasAgencyMigration = sqlMigrations().some(
  (sql) =>
    /prospect_kind/.test(sql) &&
    /agency_opportunity_score/.test(sql) &&
    /detected_services/.test(sql),
);
check(G5, hasAgencyMigration, 'a migration adds prospect_kind + agency columns to owner_prospects');

// regenerate + bulk also branch on agency vs SMB
check(
  G5,
  /isAgencyProspect\(/.test(read('app/api/owner/outreach/[id]/regenerate/route.ts')) &&
    /isAgencyProspect\(/.test(read('app/api/owner/prospects/bulk/route.ts')),
  'regenerate + bulk routes also branch agency vs SMB on prospect_kind',
);

// ─────────────────────────────────────────────────────────────────────────────
// 6. NOT AGENCY FIT does not enter the agency pipeline
// ─────────────────────────────────────────────────────────────────────────────
const G6 = '6. NOT-FIT stays SMB';
console.log(`\n${G6}`);

const scoreSrc = read('lib/owner/agency/agencyScore.ts');
check(
  G6,
  /case 'NOT AGENCY FIT':[\s\S]{0,60}return 'smb'/.test(scoreSrc) ||
    /'NOT AGENCY FIT'[\s\S]{0,120}return 'smb'/.test(scoreSrc),
  'agencyScore.decideProspectKind maps NOT AGENCY FIT -> smb (static)',
);
// runtime proof via the pure function
check(
  G6,
  decideProspectKind({ label: 'NOT AGENCY FIT', managesClientSites: true }) === 'smb',
  'decideProspectKind("NOT AGENCY FIT", managesClientSites=true) === "smb" (runtime)',
);
check(
  G6,
  decideProspectKind({ label: 'AGENCY HOT', managesClientSites: null }) === 'agency' &&
    decideProspectKind({ label: 'AGENCY WARM', managesClientSites: false }) === 'agency',
  'decideProspectKind keeps AGENCY HOT / AGENCY WARM -> agency (runtime)',
);
check(
  G6,
  decideProspectKind({ label: 'AGENCY LOW', managesClientSites: true }) === 'agency' &&
    decideProspectKind({ label: 'AGENCY LOW', managesClientSites: false }) === 'smb' &&
    decideProspectKind({ label: 'AGENCY LOW', managesClientSites: null }) === 'smb',
  'decideProspectKind AGENCY LOW -> agency only with real manages-client-sites evidence (runtime)',
);
// classification runs BEFORE the auto-scan/draft step in discovery
const engineSrc = read('lib/owner/discovery/engine.ts');
const classifyIdx = engineSrc.indexOf('classifyAgencyProspect(admin, id');
const scanIdx = engineSrc.indexOf('scanProspect(admin, id)');
check(
  G6,
  classifyIdx > -1 && scanIdx > -1 && classifyIdx < scanIdx,
  'discovery engine classifies agency prospects BEFORE the auto-scan/draft step (no premature SMB draft)',
);

// ─────────────────────────────────────────────────────────────────────────────
// 7. Internal / QA accounts excluded from founder metrics
// ─────────────────────────────────────────────────────────────────────────────
const G7 = '7. Internal/QA metrics exclusion';
console.log(`\n${G7}`);

const filtersSrc = read('lib/owner/internalAccountFilters.ts');
check(
  G7,
  /export function isInternalCustomerEmail/.test(filtersSrc) &&
    /export function isInternalCustomerProfile/.test(filtersSrc) &&
    /is_qa_account/.test(filtersSrc),
  'internalAccountFilters.ts defines isInternalCustomerEmail/Profile and honors is_qa_account',
);
const metricsSrc = read('lib/owner/metrics.ts');
check(
  G7,
  /isInternalCustomerProfile/.test(metricsSrc) && /is_qa_account/.test(metricsSrc),
  'metrics.ts filters founder metrics through isInternalCustomerProfile (incl. is_qa_account)',
);
// the send pipeline also refuses to email internal/test/customer addresses
check(
  G7,
  /isInternalCustomerEmail\(toEmail\)/.test(execSrc) && /isCustomerEmail\(admin, toEmail\)/.test(execSrc),
  'outreachExecution refuses to send to internal/test emails and existing customers',
);

// ─────────────────────────────────────────────────────────────────────────────
// 8. Free plan copy does not promise paid (continuous) monitoring
// ─────────────────────────────────────────────────────────────────────────────
const G8 = '8. Free copy honesty';
console.log(`\n${G8}`);

const planFeatures = read('lib/billing/planFeatures.ts');
// isolate the `free:` marketing block
const freeBlockMatch = planFeatures.match(/free:\s*\{[\s\S]*?\},\s*\n\s*pro:/);
const freeBlock = freeBlockMatch ? freeBlockMatch[0] : '';
check(
  G8,
  /No automated monitoring/i.test(freeBlock) || /No continuous monitoring/i.test(freeBlock),
  'planFeatures free tier explicitly states it has no automated/continuous monitoring',
);
check(
  G8,
  freeBlock.length > 0 && !/(continuous|recurring|daily|hourly)\s+monitoring/i.test(freeBlock),
  'planFeatures free tier copy does not claim continuous/recurring/daily/hourly monitoring',
);
const pricingComp = read('components/landing/Pricing.tsx');
// the free plan object in the pricing UI
const freePlanMatch = pricingComp.match(/const freePlan = \{[\s\S]*?\};/);
const freePlanBlock = freePlanMatch ? freePlanMatch[0] : '';
check(
  G8,
  /no continuous monitoring/i.test(freePlanBlock) || /One-time/i.test(freePlanBlock),
  'Pricing UI free plan is framed as a one-time preview (no continuous monitoring promise)',
);

// ─────────────────────────────────────────────────────────────────────────────
// 9. Email health uses the verified root sender
// ─────────────────────────────────────────────────────────────────────────────
const G9 = '9. Verified root sender';
console.log(`\n${G9}`);

const emailConfig = read('lib/email/config.ts');
check(
  G9,
  /export function isMailSubdomainConfigured/.test(emailConfig) &&
    /process\.env\.EMAIL_SENDING_DOMAIN/.test(emailConfig),
  'email config gates the mail subdomain behind EMAIL_SENDING_DOMAIN (intentionally unset)',
);
check(
  G9,
  /if\s*\(configured\s*&&\s*!configured\.includes\('@resend\.dev'\)\)\s*\{[\s\S]{0,80}return configured;/.test(
    emailConfig,
  ),
  'when the subdomain is not configured, getResendFromAddress falls back to the verified root EMAIL_FROM',
);
const emailHealth = read('lib/owner/emailHealth.ts');
check(
  G9,
  /Using verified root sender/.test(emailHealth) && /status:\s*'healthy'/.test(emailHealth),
  'emailHealth.ts treats the verified root sender as healthy (mail subdomain optional)',
);

// ─────────────────────────────────────────────────────────────────────────────
// 10. Pricing tiers match the current model
// ─────────────────────────────────────────────────────────────────────────────
const G10 = '10. Pricing tiers';
console.log(`\n${G10}`);

check(
  G10,
  /pro:\s*79/.test(planFeatures) && /growth:\s*149/.test(planFeatures) && /agency:\s*299/.test(planFeatures),
  'planFeatures RECOMMENDED_PLAN_PRICES_USD = Pro 79 / Growth 149 / Agency 299',
);
const marketingPrices = read('lib/billing/marketingPrices.ts');
check(
  G10,
  /pro:\s*79/.test(marketingPrices) && /growth:\s*149/.test(marketingPrices) && /agency:\s*299/.test(marketingPrices),
  'marketingPrices.ts agrees: Pro 79 / Growth 149 / Agency 299',
);
const agencyPlanPrice = /AGENCY_PLAN_PRICE\s*=\s*299/.test(scoreSrc);
check(G10, agencyPlanPrice, 'agency outreach AGENCY_PLAN_PRICE === 299 (matches Agency tier)');
check(
  G10,
  /ENTERPRISE_MARKETING/.test(planFeatures) && /Request a Security Review/.test(planFeatures),
  'Enterprise tier present (ENTERPRISE_MARKETING, custom-quote security review)',
);

// ─────────────────────────────────────────────────────────────────────────────
// 11. Mobile-critical pages exist
// ─────────────────────────────────────────────────────────────────────────────
const G11 = '11. Mobile-critical pages';
console.log(`\n${G11}`);

const criticalPages: Array<{ label: string; rel: string }> = [
  { label: 'landing', rel: 'app/page.tsx' },
  { label: 'pricing', rel: 'app/pricing/page.tsx' },
  { label: 'signup', rel: 'app/signup/page.tsx' },
  { label: 'login', rel: 'app/login/page.tsx' },
  { label: 'dashboard', rel: 'app/dashboard/page.tsx' },
  { label: 'free scan', rel: 'app/scan/page.tsx' },
  { label: 'report', rel: 'app/report/[id]/page.tsx' },
  { label: 'scan result', rel: 'app/scan-result/[id]/page.tsx' },
];
for (const { label, rel } of criticalPages) {
  check(G11, fileExists(rel), `${label} page exists (${rel})`);
}
// responsive behavior itself must be checked live
manual(G11, 'actual mobile responsiveness/layout must be verified live ([BROWSER LANE])');

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
async function run(): Promise<void> {
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL');
  const manualReviews = results.filter((r) => r.status === 'MANUAL');

  console.log('\n────────────────────────────────────────────────────────');
  console.log(
    `Summary: ${passed} passed · ${failed.length} failed · ${manualReviews.length} manual-review · ${results.length} total checks`,
  );

  if (manualReviews.length > 0) {
    console.log('\nMANUAL-REVIEW items (not failures — verify live):');
    for (const m of manualReviews) console.log(`  - [${m.group}] ${m.message}`);
  }

  if (failed.length > 0) {
    console.error('\nFAIL: product QA invariants violated:');
    for (const f of failed) console.error(`  - [${f.group}] ${f.message}`);
    process.exit(1);
  }

  console.log('\nAll product QA invariants passed.');
}

run().catch((err) => {
  console.error('\nFAIL: verification crashed:', err);
  process.exit(1);
});
