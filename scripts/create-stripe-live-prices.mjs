/**
 * Create new LIVE recurring Stripe prices for Pro/Growth/Agency.
 * Does not modify existing prices. Reads sk_live from env (never logged).
 *
 * Usage:
 *   node scripts/create-stripe-live-prices.mjs
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/create-stripe-live-prices.mjs
 */
import fs from 'fs';
import path from 'path';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.join(process.cwd(), '.env.production.local'));

const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
if (!secretKey?.startsWith('sk_live_')) {
  console.error('STRIPE_SECRET_KEY must be sk_live_ (set env or .env.production.local)');
  process.exit(1);
}

const PLANS = [
  { plan: 'pro', productId: 'prod_UhoHAE43R4sIdG', amount: 7900 },
  { plan: 'growth', productId: 'prod_UhoHEvSPv2ryxc', amount: 14900 },
  { plan: 'agency', productId: 'prod_UhoIyI5ixVqsn1', amount: 29900 },
];

async function stripePost(path, body) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body).toString(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`${path} ${res.status}: ${data.error?.message ?? JSON.stringify(data)}`);
  }
  return data;
}

async function ensurePrice({ plan, productId, amount }) {
  const list = await fetch(
    `https://api.stripe.com/v1/prices?product=${productId}&limit=100`,
    { headers: { Authorization: `Bearer ${secretKey}` } },
  ).then((r) => r.json());

  const existing = list.data?.find(
    (p) =>
      p.active &&
      p.livemode &&
      p.unit_amount === amount &&
      p.recurring?.interval === 'month',
  );
  if (existing) {
    console.log(`STRIPE_PRICE_${plan.toUpperCase()}=${existing.id} (reused)`);
    return existing.id;
  }

  const price = await stripePost('/prices', {
    product: productId,
    unit_amount: String(amount),
    currency: 'usd',
    'recurring[interval]': 'month',
    'metadata[plan]': plan,
    'metadata[pricing_tier]': '2026-06',
  });
  console.log(`STRIPE_PRICE_${plan.toUpperCase()}=${price.id} (created)`);
  return price.id;
}

const ids = {};
for (const item of PLANS) {
  ids[item.plan] = await ensurePrice(item);
}

console.log('\n--- Production Vercel env (price IDs only) ---');
console.log(`STRIPE_PRICE_PRO=${ids.pro}`);
console.log(`STRIPE_PRICE_GROWTH=${ids.growth}`);
console.log(`STRIPE_PRICE_AGENCY=${ids.agency}`);
