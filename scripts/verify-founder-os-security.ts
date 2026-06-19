/**
 * Founder OS security audit — static verification for docs/founder-os-security-audit.md
 * Run: npx tsx scripts/verify-founder-os-security.ts
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { isOwner, OWNER_EMAIL } from '../lib/auth/owner';
import { OWNER_HOME_PATH } from '../lib/auth/ownerExperience';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function ok(message: string): void {
  console.log(`OK: ${message}`);
}

function warn(message: string): void {
  console.log(`KNOWN ISSUE: ${message}`);
}

function read(rel: string): string {
  const p = join(process.cwd(), rel);
  assert(existsSync(p), `Missing file: ${rel}`);
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

const OWNER_GUARD =
  /requireOwner\s*\(|isOwner\s*\(|from\s+['"]@\/lib\/auth\/owner['"]|from\s+['"]@\/lib\/owner\/requireOwner['"]/;

console.log('CyberShield Founder OS security verification\n');

// ── Deliverable ──
assert(fileExists('docs/founder-os-security-audit.md'), 'docs/founder-os-security-audit.md must exist');
ok('Security audit document present');

// ── Owner identity + access matrix (isOwner is the single gate) ──
assert(isOwner('avanbailey@gmail.com'), 'Owner allowed');
assert(!isOwner(null), 'Anonymous (no email) denied');
assert(!isOwner('customer@example.com'), 'Normal customer denied');
assert(!isOwner('qa+test@cybershieldcloud.com'), 'QA customer denied');
assert(!isOwner('test@gmail.com'), 'Test account denied');
assert(!isOwner('owner@agency.example.com'), 'Agency customer denied');
assert(!isOwner('admin@enterprise-customer.com'), 'Enterprise customer denied');
assert(!isOwner('Avanbailey711@gmail.com'), 'Look-alike owner email denied');
assert(OWNER_HOME_PATH === '/dashboard/admin/owner', 'Owner home is Founder OS');
ok(`Access matrix: only ${OWNER_EMAIL} allowed; anonymous/customer/QA/agency/enterprise denied`);

const requireOwnerModule = read('lib/owner/requireOwner.ts');
assert(requireOwnerModule.includes('401'), 'requireOwner returns 401 for unauthenticated');
assert(requireOwnerModule.includes('403'), 'requireOwner returns 403 for non-owner');
ok('requireOwner enforces 401/403');

// ── Owner API routes ──
const ownerApiRoutes = listFiles('app/api/owner', 'route.ts');
assert(ownerApiRoutes.length >= 35, `Expected 35+ owner API routes, found ${ownerApiRoutes.length}`);
const unprotectedOwnerApis: string[] = [];
for (const route of ownerApiRoutes) {
  const content = read(route);
  if (!OWNER_GUARD.test(content)) unprotectedOwnerApis.push(route);
}
if (unprotectedOwnerApis.length > 0) {
  throw new Error(
    `FAIL: Owner API routes missing requireOwner/isOwner:\n  ${unprotectedOwnerApis.join('\n  ')}`,
  );
}
ok(`All ${ownerApiRoutes.length} /api/owner/* routes use owner guards`);

// ── Admin API routes ──
const adminApiRoutes = listFiles('app/api/admin', 'route.ts');
assert(adminApiRoutes.length >= 8, `Expected 8+ admin API routes, found ${adminApiRoutes.length}`);
const unprotectedAdminApis: string[] = [];
for (const route of adminApiRoutes) {
  const content = read(route);
  if (!OWNER_GUARD.test(content)) unprotectedAdminApis.push(route);
}
if (unprotectedAdminApis.length > 0) {
  throw new Error(
    `FAIL: Admin API routes missing isOwner/requireOwner:\n  ${unprotectedAdminApis.join('\n  ')}`,
  );
}
ok(`All ${adminApiRoutes.length} /api/admin/* routes use owner guards`);

// ── Admin page routes ──
const adminPages = listFiles('app/dashboard/admin', 'page.tsx');
const pagesMissingGuard: string[] = [];
for (const page of adminPages) {
  const content = read(page);
  if (!/isOwner\s*\(/.test(content)) pagesMissingGuard.push(page);
}
if (pagesMissingGuard.length > 0) {
  throw new Error(
    `FAIL: Admin pages missing isOwner gate:\n  ${pagesMissingGuard.join('\n  ')}`,
  );
}
ok(`All ${adminPages.length} admin pages enforce isOwner (incl. ceo-dashboard legacy redirect)`);

// ── Owner layout ──
const ownerLayout = read('app/dashboard/admin/owner/layout.tsx');
assert(ownerLayout.includes('isOwner'), 'Owner layout uses isOwner');
assert(ownerLayout.includes("redirect('/login')"), 'Non-owner redirected from owner layout');
ok('Founder OS layout blocks non-owners');

// ── Customer nav must not link Founder OS ──
const navFiles = [
  'components/dashboard/DashboardSidebar.tsx',
  'components/dashboard/DashboardShell.tsx',
  'components/enterprise/EnterprisePortalShell.tsx',
];
for (const nav of navFiles) {
  const content = read(nav);
  assert(!content.includes('/dashboard/admin/owner'), `${nav} must not hard-link Founder OS`);
}
const dashboardLayout = read('app/dashboard/layout.tsx');
assert(dashboardLayout.includes('if (owner)'), 'Dashboard layout short-circuits for owner');
assert(dashboardLayout.includes('showAdmin={owner}'), 'Admin nav gated on owner flag');
ok('Customer navigation does not expose Founder OS links to non-owners');

// ── Owner components only mounted from owner page ──
const founderOsPage = read('app/dashboard/admin/owner/page.tsx');
assert(founderOsPage.includes('isOwner'), 'Founder OS page checks isOwner');
assert(
  founderOsPage.includes('FounderOs') || founderOsPage.includes('@/components/owner/'),
  'Founder OS page imports owner components',
);
ok('Founder OS UI mounted only from owner-gated page');

// ── Middleware defense-in-depth ──
const middleware = read('lib/supabase/middleware.ts');
assert(middleware.includes('isOwnerOnlyPath'), 'Middleware defines isOwnerOnlyPath gate');
assert(middleware.includes("'/dashboard/admin'"), 'Middleware guards /dashboard/admin');
assert(middleware.includes("'/api/owner'"), 'Middleware guards /api/owner');
assert(middleware.includes("'/api/admin'"), 'Middleware guards /api/admin');
assert(
  /isOwnerOnlyPath\(pathname\)[\s\S]{0,600}!isOwner\(user\.email\)/.test(middleware),
  'Middleware denies non-owners on owner-only paths',
);
ok('Middleware blocks non-owners from /dashboard/admin, /api/owner, /api/admin (defense-in-depth)');

// ── Sitemap / robots ──
if (fileExists('app/sitemap.ts')) {
  const sitemap = read('app/sitemap.ts');
  assert(!sitemap.includes('/dashboard/admin/owner'), 'Sitemap must not list Founder OS');
  ok('Sitemap excludes Founder OS');
}
if (fileExists('app/robots.ts')) {
  const robots = read('app/robots.ts');
  assert(robots.includes('/dashboard') || robots.includes('/api'), 'Robots disallows private paths');
  ok('Robots.txt restricts dashboard/API crawling');
}

// ── RLS on owner tables ──
const founderMigration = read('supabase/migrations/20260617200000_founder_os.sql');
assert(founderMigration.includes('ENABLE ROW LEVEL SECURITY'), 'Owner tables enable RLS');
const ownerPolicyCount = (founderMigration.match(/CREATE POLICY/g) ?? []).length;
if (ownerPolicyCount === 0) {
  warn(
    'Owner tables have RLS enabled but no explicit policies in founder_os migration — deny-by-default for JWT; service role used after requireOwner',
  );
} else {
  ok(`Owner tables define ${ownerPolicyCount} RLS policies`);
}

// ── Phantom routes ──
for (const phantom of ['app/founder', 'app/owner', 'app/dashboard/owner']) {
  assert(!fileExists(phantom), `Phantom route dir should not exist: ${phantom}`);
}
ok('No /founder/* or /owner/* page routes on disk');

console.log('\nAll static Founder OS security checks passed.');
console.log('\nManual access matrix (run in browser + curl):');
console.log('  Anonymous  → GET /api/owner/founder-os → 401');
console.log('             → GET /dashboard/admin/owner → redirect /login');
console.log('  Customer   → GET /api/owner/revenue → 403');
console.log('             → GET /dashboard/admin/owner → redirect /login');
console.log('  Agency     → same as customer');
console.log('  Enterprise → /enterprise/portal OK; /api/owner/* → 403; /dashboard/admin/owner → blocked');
console.log(`  Owner      → ${OWNER_HOME_PATH} loads; /api/owner/founder-os → 200`);
