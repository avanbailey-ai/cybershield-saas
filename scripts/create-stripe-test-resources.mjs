/**
 * After Stripe CLI login, create test products/prices/webhook and print env setup hints.
 * Usage: node scripts/create-stripe-test-resources.mjs --preview-url=https://...
 * Requires: stripe CLI authenticated OR STRIPE_API_KEY=sk_test_...
 */
import { execSync } from 'child_process';

const STRIPE =
  process.env.STRIPE_CLI ??
  'C:\\Users\\Player1\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Stripe.StripeCli_Microsoft.Winget.Source_8wekyb3d8bbwe\\stripe.exe';

const previewUrl = (process.argv.find((a) => a.startsWith('--preview-url=')) ?? '').split('=')[1]?.replace(/\/$/, '');
if (!previewUrl) {
  console.error('Usage: --preview-url=https://your-preview.vercel.app');
  process.exit(1);
}

function run(args) {
  return execSync(`"${STRIPE}" ${args}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function prefix(v) {
  if (!v) return 'MISSING';
  if (v.startsWith('sk_test_')) return 'sk_test_';
  if (v.startsWith('pk_test_')) return 'pk_test_';
  if (v.startsWith('whsec_')) return 'whsec_';
  if (v.startsWith('price_')) return `price_(${v.length}c)`;
  return `SET(${v.length}c)`;
}

// Verify test mode
const productsJson = run('products list --limit 3');
console.log('stripe products list ok');

async function ensureProduct(name, amountCents) {
  const list = JSON.parse(run(`products list --limit 100`));
  let product = list.data?.find((p) => p.name === name);
  if (!product) {
    product = JSON.parse(run(`products create --name="${name}"`));
    console.log('created product', name);
  }
  const prices = JSON.parse(run(`prices list --product ${product.id} --limit 20`));
  let price = prices.data?.find((p) => p.recurring?.interval === 'month' && p.unit_amount === amountCents);
  if (!price) {
    price = JSON.parse(
      run(
        `prices create --product ${product.id} --unit-amount ${amountCents} --currency usd --recurring interval=month`,
      ),
    );
    console.log('created price for', name, prefix(price.id));
  } else {
    console.log('reused price for', name, prefix(price.id));
  }
  return price.id;
}

const proPrice = await ensureProduct('CyberShield Pro', 2900);
const growthPrice = await ensureProduct('CyberShield Growth', 7900);
const agencyPrice = await ensureProduct('CyberShield Agency', 19900);

const webhookUrl = `${previewUrl}/api/stripe/webhook`;
const hooks = JSON.parse(run('webhook_endpoints list --limit 20'));
let hook = hooks.data?.find((h) => h.url === webhookUrl);
if (!hook) {
  hook = JSON.parse(
    run(
      `webhook_endpoints create --url "${webhookUrl}" -d checkout.session.completed -d checkout.session.expired -d customer.subscription.updated -d customer.subscription.deleted -d invoice.paid -d invoice.payment_failed`,
    ),
  );
  console.log('created webhook endpoint');
} else {
  console.log('reused webhook endpoint');
}

console.log('\n--- Set these as Preview env vars (prefix check only) ---');
console.log('STRIPE_PRICE_PRO =>', prefix(proPrice));
console.log('STRIPE_PRICE_GROWTH =>', prefix(growthPrice));
console.log('STRIPE_PRICE_AGENCY =>', prefix(agencyPrice));
console.log('STRIPE_WEBHOOK_SECRET =>', prefix(hook.secret));
console.log('NEXT_PUBLIC_SITE_URL =>', previewUrl);
console.log('\nFetch sk_test_/pk_test_ from: stripe config --list or Dashboard > Developers > API keys (test mode)');
console.log('\nThen run setup-preview-stripe-env.mjs with STRIPE_TEST_* env vars set (never log secret values).');
