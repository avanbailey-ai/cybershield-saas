/**
 * Configure Preview-only Stripe test env vars on Vercel.
 * Usage: node scripts/setup-preview-stripe-env.mjs --preview-url=https://... [--dry-run]
 * Reads test credentials from env (never logged):
 *   STRIPE_TEST_SECRET_KEY, STRIPE_TEST_PUBLISHABLE_KEY, STRIPE_TEST_WEBHOOK_SECRET
 *   STRIPE_TEST_PRICE_PRO, STRIPE_TEST_PRICE_GROWTH, STRIPE_TEST_PRICE_AGENCY
 */
import fs from 'fs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const dryRun = args['dry-run'] === true || args['dry-run'] === 'true';
const previewUrl = (args['preview-url'] ?? process.env.PREVIEW_URL ?? '').replace(/\/$/, '');
if (!previewUrl) {
  console.error('Missing --preview-url');
  process.exit(1);
}

const testEnv = {
  STRIPE_SECRET_KEY: process.env.STRIPE_TEST_SECRET_KEY,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_TEST_PUBLISHABLE_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_TEST_WEBHOOK_SECRET,
  STRIPE_PRICE_PRO: process.env.STRIPE_TEST_PRICE_PRO,
  STRIPE_PRICE_GROWTH: process.env.STRIPE_TEST_PRICE_GROWTH,
  STRIPE_PRICE_AGENCY: process.env.STRIPE_TEST_PRICE_AGENCY,
  NEXT_PUBLIC_SITE_URL: previewUrl,
};

function assertPrefixes() {
  if (!testEnv.STRIPE_SECRET_KEY?.startsWith('sk_test_')) throw new Error('STRIPE_TEST_SECRET_KEY must start with sk_test_');
  if (!testEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_')) throw new Error('STRIPE_TEST_PUBLISHABLE_KEY must start with pk_test_');
  if (!testEnv.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')) throw new Error('STRIPE_TEST_WEBHOOK_SECRET must start with whsec_');
  for (const k of ['STRIPE_PRICE_PRO', 'STRIPE_PRICE_GROWTH', 'STRIPE_PRICE_AGENCY']) {
    if (!testEnv[k]?.startsWith('price_')) throw new Error(`${k} must start with price_`);
  }
}

assertPrefixes();

const auth = JSON.parse(
  fs.readFileSync(`${process.env.APPDATA}/xdg.data/com.vercel.cli/auth.json`, 'utf8'),
);
const teamId = 'team_gtd3zKNPLnEEb4UZ5mQNv27R';
const projectId = 'prj_j0wGm9zjJcL9aTaugQlyu8IhZdwu';
const headers = {
  Authorization: `Bearer ${auth.token}`,
  'Content-Type': 'application/json',
};

async function api(path, opts = {}) {
  const url = `https://api.vercel.com${path}`;
  const res = await fetch(url, { ...opts, headers: { ...headers, ...opts.headers } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${opts.method ?? 'GET'} ${path} ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

const stripeKeys = [
  'STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_PRO',
  'STRIPE_PRICE_GROWTH',
  'STRIPE_PRICE_AGENCY',
  'NEXT_PUBLIC_SITE_URL',
];

const envs = await api(`/v10/projects/${projectId}/env?teamId=${teamId}`);
const byKey = new Map();
for (const row of envs.envs) {
  if (!byKey.has(row.key)) byKey.set(row.key, []);
  byKey.get(row.key).push(row);
}

console.log('dryRun', dryRun, 'previewUrl', previewUrl);

for (const key of stripeKeys) {
  const rows = byKey.get(key) ?? [];
  const shared = rows.find((r) => (r.target ?? []).includes('preview') && (r.target ?? []).includes('production'));
  const previewOnly = rows.find((r) => {
    const t = r.target ?? [];
    return t.includes('preview') && !t.includes('production');
  });

  if (shared) {
    const newTarget = (shared.target ?? []).filter((t) => t !== 'preview');
    console.log(`PATCH ${key} id=${shared.id} target=${newTarget.join(',') || 'remove-preview-from-shared'}`);
    if (!dryRun && newTarget.length) {
      await api(`/v10/projects/${projectId}/env/${shared.id}?teamId=${teamId}`, {
        method: 'PATCH',
        body: JSON.stringify({ target: newTarget }),
      });
    }
  }

  const value = testEnv[key];
  if (previewOnly) {
    console.log(`PATCH preview-only ${key} id=${previewOnly.id}`);
    if (!dryRun) {
      await api(`/v10/projects/${projectId}/env/${previewOnly.id}?teamId=${teamId}`, {
        method: 'PATCH',
        body: JSON.stringify({ value, target: ['preview'] }),
      });
    }
  } else {
    console.log(`POST preview-only ${key}`);
    if (!dryRun) {
      await api(`/v10/projects/${projectId}/env?teamId=${teamId}`, {
        method: 'POST',
        body: JSON.stringify({
          key,
          value,
          type: key.startsWith('NEXT_PUBLIC_') ? 'plain' : 'encrypted',
          target: ['preview'],
        }),
      });
    }
  }
}

// Copy CRON_SECRET to preview if missing
const cronRows = byKey.get('CRON_SECRET') ?? [];
const cronPreview = cronRows.find((r) => (r.target ?? []).includes('preview'));
const cronProd = cronRows.find((r) => (r.target ?? []).includes('production') && !(r.target ?? []).includes('preview'));
if (!cronPreview && cronProd) {
  console.log('CRON_SECRET missing on preview — copy manually from production in Vercel dashboard');
}

console.log('Done. Redeploy staging/stripe-e2e preview next.');
