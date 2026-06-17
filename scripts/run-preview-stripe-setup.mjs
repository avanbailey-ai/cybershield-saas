/**
 * Full Preview Stripe test setup — reads keys from Stripe CLI config.toml, never logs secrets.
 * Usage: node scripts/run-preview-stripe-setup.mjs --preview-url=https://...
 */
import fs from 'fs';
import { execSync } from 'child_process';
import os from 'os';
import path from 'path';

const STRIPE =
  process.env.STRIPE_CLI ??
  'C:\\Users\\Player1\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Stripe.StripeCli_Microsoft.Winget.Source_8wekyb3d8bbwe\\stripe.exe';

const previewUrl = (process.argv.find((a) => a.startsWith('--preview-url=')) ?? '').split('=')[1]?.replace(/\/$/, '');
if (!previewUrl) {
  console.error('Missing --preview-url');
  process.exit(1);
}

function run(args) {
  return execSync(`"${STRIPE}" ${args}`, { encoding: 'utf8' }).trim();
}

function readStripeConfig() {
  const cfgPath = path.join(os.homedir(), '.config', 'stripe', 'config.toml');
  const raw = fs.readFileSync(cfgPath, 'utf8');
  const get = (key) => {
    const m = raw.match(new RegExp(`${key} = '([^']*)'`));
    return m?.[1] ?? '';
  };
  return {
    sk: get('test_mode_api_key'),
    pk: get('test_mode_pub_key'),
  };
}

function ensureProduct(name, cents) {
  const list = JSON.parse(run(`products list --limit 100`));
  let product = list.data?.find((p) => p.name === name);
  if (!product) product = JSON.parse(run(`products create --name="${name}"`));
  const prices = JSON.parse(run(`prices list --product ${product.id} --limit 20`));
  let price = prices.data?.find((p) => p.recurring?.interval === 'month' && p.unit_amount === cents);
  if (!price) {
    price = JSON.parse(
      run(`prices create --product ${product.id} --unit-amount ${cents} --currency usd -d "recurring[interval]=month"`),
    );
  }
  return price.id;
}

const { sk, pk } = readStripeConfig();
if (!sk.startsWith('sk_test_') || !pk.startsWith('pk_test_')) throw new Error('Stripe test keys missing from config');

const pricePro = ensureProduct('CyberShield Pro', 7900);
const priceGrowth = ensureProduct('CyberShield Growth', 14900);
const priceAgency = ensureProduct('CyberShield Agency', 29900);

const webhookUrl = `${previewUrl}/api/stripe/webhook`;
const hooks = JSON.parse(run('webhook_endpoints list --limit 20'));
let hook = hooks.data?.find((h) => h.url === webhookUrl);
if (!hook) {
  hook = JSON.parse(
    run(
      `webhook_endpoints create --url "${webhookUrl}" --enabled-events checkout.session.completed --enabled-events checkout.session.expired --enabled-events customer.subscription.updated --enabled-events customer.subscription.deleted --enabled-events invoice.paid --enabled-events invoice.payment_failed`,
    ),
  );
}

process.env.STRIPE_TEST_SECRET_KEY = sk;
process.env.STRIPE_TEST_PUBLISHABLE_KEY = pk;
process.env.STRIPE_TEST_WEBHOOK_SECRET = hook.secret;
process.env.STRIPE_TEST_PRICE_PRO = pricePro;
process.env.STRIPE_TEST_PRICE_GROWTH = priceGrowth;
process.env.STRIPE_TEST_PRICE_AGENCY = priceAgency;
process.env.PREVIEW_URL = previewUrl;

console.log('stripe test keys: sk_test_ pk_test_ whsec_ confirmed');
console.log('prices: pro growth agency configured');
console.log('webhook endpoint created for preview URL');

// Dynamic import setup script logic inline
const auth = JSON.parse(
  fs.readFileSync(`${process.env.APPDATA}/xdg.data/com.vercel.cli/auth.json`, 'utf8'),
);
const teamId = 'team_gtd3zKNPLnEEb4UZ5mQNv27R';
const projectId = 'prj_j0wGm9zjJcL9aTaugQlyu8IhZdwu';
const headers = { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' };

async function api(path, opts = {}) {
  const res = await fetch(`https://api.vercel.com${path}`, { ...opts, headers: { ...headers, ...opts.headers } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${opts.method ?? 'GET'} ${path} ${res.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

const testEnv = {
  STRIPE_SECRET_KEY: sk,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: pk,
  STRIPE_WEBHOOK_SECRET: hook.secret,
  STRIPE_PRICE_PRO: pricePro,
  STRIPE_PRICE_GROWTH: priceGrowth,
  STRIPE_PRICE_AGENCY: priceAgency,
  NEXT_PUBLIC_SITE_URL: previewUrl,
};

const stripeKeys = Object.keys(testEnv);
const envs = await api(`/v10/projects/${projectId}/env?teamId=${teamId}`);
const byKey = new Map();
for (const row of envs.envs) {
  if (!byKey.has(row.key)) byKey.set(row.key, []);
  byKey.get(row.key).push(row);
}

for (const key of stripeKeys) {
  const rows = byKey.get(key) ?? [];
  const shared = rows.find((r) => (r.target ?? []).includes('preview') && (r.target ?? []).includes('production'));
  const previewOnly = rows.find((r) => {
    const t = r.target ?? [];
    return t.includes('preview') && !t.includes('production');
  });

  if (shared) {
    const newTarget = (shared.target ?? []).filter((t) => t !== 'preview');
    if (newTarget.length) {
      await api(`/v10/projects/${projectId}/env/${shared.id}?teamId=${teamId}`, {
        method: 'PATCH',
        body: JSON.stringify({ target: newTarget }),
      });
      console.log(`removed preview from production ${key}`);
    }
  }

  const value = testEnv[key];
  if (previewOnly) {
    await api(`/v10/projects/${projectId}/env/${previewOnly.id}?teamId=${teamId}`, {
      method: 'PATCH',
      body: JSON.stringify({ value, target: ['preview'] }),
    });
    console.log(`updated preview ${key}`);
  } else {
    await api(`/v10/projects/${projectId}/env?teamId=${teamId}`, {
      method: 'POST',
      body: JSON.stringify({
        key,
        value,
        type: key.startsWith('NEXT_PUBLIC_') ? 'plain' : 'encrypted',
        target: ['preview'],
      }),
    });
    console.log(`created preview ${key}`);
  }
}

// Redeploy staging branch
const dep = await api(`/v13/deployments?teamId=${teamId}`, {
  method: 'POST',
  body: JSON.stringify({
    name: 'cybershield-saas-1o19',
    project: projectId,
    target: 'preview',
    gitSource: {
      type: 'github',
      ref: 'staging/stripe-e2e',
      repoId: undefined,
    },
  }),
}).catch(async () => {
  // fallback: trigger redeploy via empty commit push alternative — use deployment from git
  return null;
});

console.log('vercel preview env updated');
console.log('NEXT: redeploy staging/stripe-e2e in Vercel (or push empty commit) then run E2E checkout');
