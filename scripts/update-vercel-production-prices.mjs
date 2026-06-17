/**
 * Update Production STRIPE_PRICE_* env vars on Vercel (price IDs only).
 *
 * Usage:
 *   node scripts/update-vercel-production-prices.mjs \
 *     --pro=price_... --growth=price_... --agency=price_...
 */
import fs from 'fs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v];
  }),
);

const pricePro = args.pro;
const priceGrowth = args.growth;
const priceAgency = args.agency;

if (!pricePro?.startsWith('price_') || !priceGrowth?.startsWith('price_') || !priceAgency?.startsWith('price_')) {
  console.error('Usage: --pro=price_... --growth=price_... --agency=price_...');
  process.exit(1);
}

const authPath = `${process.env.APPDATA}/xdg.data/com.vercel.cli/auth.json`;
const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
const teamId = 'team_gtd3zKNPLnEEb4UZ5mQNv27R';
const projectId = 'prj_j0wGm9zjJcL9aTaugQlyu8IhZdwu';
const headers = {
  Authorization: `Bearer ${auth.token}`,
  'Content-Type': 'application/json',
};

async function api(path, opts = {}) {
  const res = await fetch(`https://api.vercel.com${path}`, {
    ...opts,
    headers: { ...headers, ...opts.headers },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${opts.method ?? 'GET'} ${path} ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

const envs = await api(`/v10/projects/${projectId}/env?teamId=${teamId}`);
const byKey = new Map();
for (const row of envs.envs) {
  if (!byKey.has(row.key)) byKey.set(row.key, []);
  byKey.get(row.key).push(row);
}

const updates = {
  STRIPE_PRICE_PRO: pricePro,
  STRIPE_PRICE_GROWTH: priceGrowth,
  STRIPE_PRICE_AGENCY: priceAgency,
};

for (const [key, value] of Object.entries(updates)) {
  const rows = byKey.get(key) ?? [];
  const prodRow = rows.find((r) => (r.target ?? []).includes('production'));
  if (!prodRow) {
    console.log(`POST ${key} production`);
    await api(`/v10/projects/${projectId}/env?teamId=${teamId}`, {
      method: 'POST',
      body: JSON.stringify({
        key,
        value,
        type: 'encrypted',
        target: ['production'],
      }),
    });
  } else {
    console.log(`UPDATE ${key} id=${prodRow.id}`);
    await api(`/v10/projects/${projectId}/env/${prodRow.id}?teamId=${teamId}`, {
      method: 'PATCH',
      body: JSON.stringify({ value, target: ['production'] }),
    });
  }
}

console.log('Production STRIPE_PRICE_* updated. Redeploy production to apply.');
