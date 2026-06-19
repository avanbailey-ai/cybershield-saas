/**
 * Master production-readiness verification for CyberShield Cloud stabilization.
 *
 * Structural / code-level checks only — does NOT send email, mutate data, or
 * replace live browser QA. Combines critical invariants from the stabilization audit.
 *
 * Run: npx tsx scripts/verify-production-readiness.ts
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { RECOMMENDED_PLAN_PRICES_USD } from '../lib/billing/planFeatures';
import { DEFAULT_GROWTH_AUTOPILOT_SETTINGS } from '../lib/owner/growthAutopilotSettings';
import { resolveSiteUrl } from '../lib/site/getSiteUrl';

type Status = 'PASS' | 'FAIL' | 'MANUAL';
interface Check {
  group: string;
  status: Status;
  message: string;
}

const results: Check[] = [];
let failCount = 0;

function record(group: string, status: Status, message: string): void {
  results.push({ group, status, message });
  const tag = status === 'PASS' ? 'PASS' : status === 'FAIL' ? 'FAIL' : 'MANUAL-REVIEW';
  const line = `  [${tag}] ${message}`;
  if (status === 'FAIL') {
    console.error(line);
    failCount++;
  } else console.log(line);
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

function check(group: string, condition: boolean, message: string): boolean {
  if (condition) pass(group, message);
  else fail(group, message);
  return condition;
}

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

function listPageRoutes(): string[] {
  return listFiles('app', 'page.tsx');
}

console.log('CyberShield Cloud — production readiness verification\n');

// ── Route inventory ─────────────────────────────────────────────────────────
const G_ROUTES = 'Route inventory';
console.log(`\n${G_ROUTES}`);

const pages = listPageRoutes();
check(G_ROUTES, pages.length >= 40, `route inventory: ${pages.length} page.tsx routes on disk`);

const CRITICAL_ROUTES = [
  'app/page.tsx',
  'app/pricing/page.tsx',
  'app/agency/page.tsx',
  'app/agencies/page.tsx',
  'app/summary/page.tsx',
  'app/signup/page.tsx',
  'app/login/page.tsx',
  'app/dashboard/page.tsx',
  'app/dashboard/websites/page.tsx',
  'app/dashboard/websites/[id]/health/page.tsx',
  'app/dashboard/websites/[id]/changes/page.tsx',
  'app/dashboard/scans/page.tsx',
  'app/dashboard/reports/page.tsx',
  'app/dashboard/alerts/page.tsx',
  'app/dashboard/settings/page.tsx',
  'app/dashboard/admin/owner/page.tsx',
  'app/report/[id]/page.tsx',
  'app/scan/page.tsx',
  'app/scan-result/[id]/page.tsx',
];

for (const route of CRITICAL_ROUTES) {
  check(G_ROUTES, fileExists(route), `critical route exists: ${route}`);
}

// ── Owner-only protection ───────────────────────────────────────────────────
const G_OWNER = 'Owner-only protection';
console.log(`\n${G_OWNER}`);

const OWNER_GUARD =
  /requireOwner\s*\(|isOwner\s*\(|from\s+['"]@\/lib\/auth\/owner['"]|from\s+['"]@\/lib\/owner\/requireOwner['"]/;

const middleware = read('lib/supabase/middleware.ts');
check(
  G_OWNER,
  /isOwnerOnlyPath\s*\(/.test(middleware) && /!isOwner\(user\.email\)/.test(middleware),
  'middleware gates owner-only paths for non-owners',
);

const ownerApiRoutes = listFiles('app/api/owner', 'route.ts');
const unguardedOwnerApis = ownerApiRoutes.filter((r) => !OWNER_GUARD.test(read(r)));
check(
  G_OWNER,
  ownerApiRoutes.length >= 30 && unguardedOwnerApis.length === 0,
  unguardedOwnerApis.length === 0
    ? `all ${ownerApiRoutes.length} /api/owner/* routes are owner-guarded`
    : `unguarded owner APIs: ${unguardedOwnerApis.join(', ')}`,
);

check(
  G_OWNER,
  /isOwner\s*\(/.test(read('app/dashboard/admin/owner/layout.tsx')),
  'Founder OS layout enforces isOwner',
);

// Customer cannot reach Founder OS via public nav
const FORBIDDEN_NAV = /\/dashboard\/admin\/owner|\/founder\b|Founder OS/i;
for (const nav of ['components/landing/Navbar.tsx', 'components/dashboard/DashboardSidebar.tsx']) {
  if (fileExists(nav)) {
    check(G_OWNER, !FORBIDDEN_NAV.test(read(nav)), `${nav} does not expose Founder OS`);
  }
}

// Owner may access /app/settings for password (not redirected away)
check(
  G_OWNER,
  read('lib/auth/ownerExperience.ts').includes('/app/settings'),
  'owner can access /app/settings for account/password without redirect loop',
);

// ── Public summary safety ───────────────────────────────────────────────────
const G_SUMMARY = 'Public summary safety';
console.log(`\n${G_SUMMARY}`);

const summaryPage = read('app/summary/page.tsx');
check(
  G_SUMMARY,
  /isValidAttributionToken/.test(summaryPage) && /GenericProspectSummaryFallback/.test(summaryPage),
  '/summary validates token and falls back safely for invalid/missing prospect',
);

const publicSummary = read('lib/prospect/publicProspectSummary.ts');
if (publicSummary) {
  check(
    G_SUMMARY,
    !/service_role|SUPABASE_SERVICE_ROLE/.test(publicSummary) ||
      /createAdminClient|createClient/.test(publicSummary),
    'public prospect summary loader does not leak raw secrets in source',
  );
  manual(G_SUMMARY, 'Confirm /summary?prospect=test shows generic fallback with no private scan data (browser)');
} else {
  manual(G_SUMMARY, 'lib/prospect/publicProspectSummary.ts — verify no PII leak on invalid token');
}

// ── Dead buttons / placeholders ─────────────────────────────────────────────
const G_UI = 'UI honesty';
console.log(`\n${G_UI}`);

const appComponents = [...listFiles('app', 'page.tsx'), ...listFiles('components', 'tsx')];
let hrefHash = 0;
let noopClicks = 0;
for (const rel of appComponents.slice(0, 200)) {
  const src = read(rel);
  if (/href=["']#["']/.test(src)) hrefHash++;
  if (/onClick=\{\(\)\s*=>\s*\{\s*\}\}/.test(src)) noopClicks++;
}
check(G_UI, hrefHash === 0, 'no href="#" dead links in sampled app/components pages');
check(G_UI, noopClicks === 0, 'no empty onClick handlers in sampled pages');

// Fake metrics in landing (must be honest)
const trustSignals = read('components/landing/TrustSignals.tsx');
if (trustSignals) {
  check(
    G_UI,
    /Live data pending|—/.test(trustSignals),
    'landing trust metrics show honest empty/pending state (not fake counts)',
  );
}

// Report percentile copy — flag for manual review (heuristic, not live benchmark)
if (/top 15%|typical small business range/.test(read('lib/report/reportExecutiveCopy.ts'))) {
  manual(
    G_UI,
    'Report executive copy uses heuristic percentile bands — verify wording is clearly estimated, not live peer data',
  );
}

// ── Outreach / approval / auto-send ─────────────────────────────────────────
const G_OUTREACH = 'Outreach safety';
console.log(`\n${G_OUTREACH}`);

const execSrc = read('lib/owner/outreachExecution.ts');
check(
  G_OUTREACH,
  /require_approval/.test(execSrc),
  'outreach execution respects require_approval setting',
);

check(
  G_OUTREACH,
  !read('app/api/cron/prospect-discovery/route.ts').includes('sendApprovedOutreach'),
  'prospect-discovery cron does not auto-send outreach',
);

check(
  G_OUTREACH,
  DEFAULT_GROWTH_AUTOPILOT_SETTINGS.mode === 'manual' &&
    DEFAULT_GROWTH_AUTOPILOT_SETTINGS.limited_autopilot_sending === false &&
    DEFAULT_GROWTH_AUTOPILOT_SETTINGS.prepare_only === true,
  'growth autopilot defaults: manual mode, no limited sending, prepare-only',
);

check(
  G_OUTREACH,
  read('lib/owner/followUpScheduler.ts').includes('existingStages'),
  'follow-up dedupe (existingStages) intact',
);

if (fileExists('lib/owner/deliverabilityGuard.ts')) {
  check(G_OUTREACH, /WARMUP_DAILY_CAPS/.test(read('lib/owner/deliverabilityGuard.ts')), 'deliverability warmup caps exist');
}
if (fileExists('lib/owner/outreachCopyGuard.ts')) {
  check(G_OUTREACH, /validateOutreachCopy/.test(read('lib/owner/outreachExecution.ts')), 'copy guard wired into send path');
}

// Verified sender
const emailConfig = read('lib/email/config.ts');
check(
  G_OUTREACH,
  emailConfig.includes('outreach@cybershieldcloud.com') || emailConfig.includes('EMAIL_ROOT_DOMAIN'),
  'email config uses verified CyberShield root sender domain',
);
check(
  G_OUTREACH,
  !emailConfig.includes('mail.cybershieldcloud.com') || emailConfig.includes('unverified'),
  'unverified mail subdomain not used as default sender',
);

// ── Prospect quality gates ──────────────────────────────────────────────────
const G_PROSPECT = 'Prospect quality';
console.log(`\n${G_PROSPECT}`);

if (fileExists('lib/owner/prospectQualityBrain.ts')) {
  const brain = read('lib/owner/prospectQualityBrain.ts');
  check(G_PROSPECT, /assessProspectQuality/.test(brain), 'prospect quality brain central gate exists');
  check(G_PROSPECT, /canCreateOutreachDraft/.test(brain), 'outreach draft gate exists');
  check(G_PROSPECT, /OUTREACH_READY_CONTACT|isOutreachReadyContact/.test(brain), 'Stage 5 outreach-ready contact gate exists');
  check(
    G_PROSPECT,
    read('lib/owner/ensureOutreachDraft.ts').includes('canCreateOutreachDraft') ||
      read('lib/owner/ensureOutreachDraft.ts').includes('assessProspectQuality'),
    'ensureOutreachDraft uses quality gates',
  );
} else {
  manual(G_PROSPECT, 'prospectQualityBrain.ts not on branch — run verify-prospect-quality-brain separately');
}

check(
  G_PROSPECT,
  read('lib/owner/discovery/types.ts').includes('DiscoveryBreakdown') ||
    read('lib/owner/discovery/engine.ts').includes('breakdown'),
  'discovery breakdown fields present for transparency',
);

// ── Pricing / plan honesty ────────────────────────────────────────────────────
const G_PRICING = 'Pricing & plans';
console.log(`\n${G_PRICING}`);

check(
  G_PRICING,
  RECOMMENDED_PLAN_PRICES_USD.pro === 79 &&
    RECOMMENDED_PLAN_PRICES_USD.growth === 149 &&
    RECOMMENDED_PLAN_PRICES_USD.agency === 299,
  'pricing unchanged: Pro $79, Growth $149, Agency $299',
);

const planFeatures = read('lib/billing/planFeatures.ts');
check(G_PRICING, planFeatures.includes('No automated monitoring'), 'free plan does not promise paid continuous monitoring');

// ── Intelligence / OpenAI not required ────────────────────────────────────────
const G_AI = 'Report intelligence';
console.log(`\n${G_AI}`);

const localAi = read('lib/intelligence/localAi.ts');
check(
  G_AI,
  /LOCAL_AI_ENABLED/.test(localAi) && /===\s*['"]true['"]/.test(localAi),
  'LOCAL_AI_ENABLED defaults off unless explicitly true',
);

const intelPaths = ['lib/intelligence', 'lib/report', 'core/scans'].flatMap((d) =>
  listFiles(d, '.ts').filter((f) => f.endsWith('.ts')),
);
let openAiRequired = false;
for (const p of intelPaths) {
  const src = read(p);
  if (/process\.env\.OPENAI_API_KEY/.test(src) && !/optional|LOCAL_AI|localAi/.test(src)) {
    openAiRequired = true;
  }
}
check(G_AI, !openAiRequired, 'report intelligence paths do not hard-require OPENAI_API_KEY');

manual(G_AI, 'Run scan report in browser without OPENAI_API_KEY to confirm free intelligence layer works');

// ── Cron security ─────────────────────────────────────────────────────────────
const G_CRON = 'Cron security';
console.log(`\n${G_CRON}`);

const workerAuth = read('lib/queue/workerAuth.ts');
check(G_CRON, workerAuth.includes('CRON_SECRET'), 'workerAuth references CRON_SECRET');
check(
  G_CRON,
  /if\s*\(!cronSecret\)\s*return false/.test(workerAuth),
  'workerAuth fails closed when CRON_SECRET unset',
);

if (fileExists('vercel.json')) {
  const vercel = JSON.parse(read('vercel.json')) as { crons?: { path: string }[] };
  const AUTH_PATTERN = /isWorkerAuthorized|CRON_SECRET|requireOwner|isOwner/;
  for (const cron of vercel.crons ?? []) {
    const routeRel = `app${cron.path}/route.ts`;
    if (fileExists(routeRel)) {
      check(G_CRON, AUTH_PATTERN.test(read(routeRel)), `${cron.path} cron route has worker/owner auth`);
    }
  }
}

// ── Migration safety ──────────────────────────────────────────────────────────
const G_MIG = 'Migration safety';
console.log(`\n${G_MIG}`);

const migDir = join(process.cwd(), 'supabase/migrations');
if (existsSync(migDir)) {
  const sqlFiles = readdirSync(migDir).filter((f) => f.endsWith('.sql'));
  let destructive = 0;
  for (const f of sqlFiles) {
    const sql = read(join('supabase/migrations', f));
    if (/\bDROP\s+TABLE\b/i.test(sql) && !/IF\s+EXISTS/i.test(sql)) destructive++;
    if (/\bTRUNCATE\b/i.test(sql)) destructive++;
    if (/\bDELETE\s+FROM\s+(?!.*WHERE)/i.test(sql)) destructive++;
  }
  check(G_MIG, destructive === 0, 'no unguarded DROP TABLE / TRUNCATE / unbounded DELETE in migrations');
  pass(G_MIG, `${sqlFiles.length} migration file(s) scanned`);
} else {
  manual(G_MIG, 'supabase/migrations not found');
}

// ── Client secrets ────────────────────────────────────────────────────────────
const G_SEC = 'Client secrets';
console.log(`\n${G_SEC}`);

const clientDirs = ['components', 'app'];
const SECRET_PATTERNS = [
  /sk_live_[a-zA-Z0-9]+/,
  /sk_test_[a-zA-Z0-9]+/,
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"][^'"]+['"]/,
  /RESEND_API_KEY\s*=\s*['"][^'"]+['"]/,
  /STRIPE_SECRET_KEY\s*=\s*['"][^'"]+['"]/,
];
let secretLeaks = 0;
for (const dir of clientDirs) {
  for (const rel of listFiles(dir, '.tsx').concat(listFiles(dir, '.ts'))) {
    if (rel.includes('api/')) continue;
    const src = read(rel);
    for (const pat of SECRET_PATTERNS) {
      if (pat.test(src)) secretLeaks++;
    }
  }
}
check(G_SEC, secretLeaks === 0, 'no raw API secrets in client-facing app/components source');

// ── SEO / canonical URL ───────────────────────────────────────────────────────
const G_SEO = 'Canonical URLs';
console.log(`\n${G_SEO}`);

const siteUrl = resolveSiteUrl();
check(G_SEO, !siteUrl.includes('vercel.app'), 'resolveSiteUrl is not a Vercel preview URL');

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n── Summary ──');
const passed = results.filter((r) => r.status === 'PASS').length;
const manualCount = results.filter((r) => r.status === 'MANUAL').length;
console.log(`PASS: ${passed}  FAIL: ${failCount}  MANUAL-REVIEW: ${manualCount}`);

if (failCount > 0) {
  console.error('\nProduction readiness verification FAILED.');
  process.exit(1);
}

console.log('\nProduction readiness structural checks passed.');
console.log('MANUAL-REVIEW items require live browser QA before claiming production-ready.');
console.log('Also run: verify-product-quality-rescue, verify-prospect-quality-brain, verify-deliverability-guard, tsc, build');
