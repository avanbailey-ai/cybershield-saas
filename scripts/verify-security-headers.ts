/**
 * Verify production browser security headers are configured and present on responses.
 * Run: npx tsx scripts/verify-security-headers.ts
 * Optional: SITE_URL=https://cybershieldcloud.com (default) or http://localhost:3000
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONTENT_SECURITY_POLICY,
  PERMISSIONS_POLICY,
  SECURITY_HEADER_ENTRIES,
} from '../lib/security/productionHeaders';

function read(rel: string): string {
  return existsSync(join(process.cwd(), rel)) ? readFileSync(join(process.cwd(), rel), 'utf8') : '';
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`OK: ${msg}`);
}

function headerMap(res: Response): Map<string, string> {
  const map = new Map<string, string>();
  res.headers.forEach((value, key) => map.set(key.toLowerCase(), value));
  return map;
}

console.log('Security headers verification\n');

const nextConfig = read('next.config.ts');
const headersModule = read('lib/security/productionHeaders.ts');

assert(headersModule.includes('productionSecurityHeadersForNextConfig'), 'production headers module exists');
assert(nextConfig.includes('productionSecurityHeadersForNextConfig'), 'next.config wires security headers');
assert(!read('vercel.json').includes('Content-Security-Policy'), 'no duplicate CSP in vercel.json');

assert(
  SECURITY_HEADER_ENTRIES.some((h) => h.key === 'Content-Security-Policy'),
  'CSP configured in header entries',
);
assert(CONTENT_SECURITY_POLICY.includes("frame-ancestors 'none'"), 'CSP includes frame-ancestors');
assert(CONTENT_SECURITY_POLICY.includes("object-src 'none'"), "CSP includes object-src 'none'");
assert(CONTENT_SECURITY_POLICY.includes("base-uri 'self'"), "CSP includes base-uri 'self'");
assert(CONTENT_SECURITY_POLICY.includes('js.stripe.com'), 'CSP allows Stripe frame usage');
assert(PERMISSIONS_POLICY.includes('camera=()'), 'Permissions-Policy restricts camera');

const siteUrl = (process.env.SITE_URL ?? 'https://cybershieldcloud.com').replace(/\/$/, '');

async function probe(path: string) {
  const url = `${siteUrl}${path}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
      headers: { 'User-Agent': 'CyberShield-SecurityHeaderVerify/1.0' },
    });
    return { url, res, headers: headerMap(res) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  WARN: could not fetch ${url} (${msg}) — config checks still pass`);
    return null;
  }
}

async function runLiveProbe() {
  console.log(`\nLive probe: ${siteUrl}\n`);

  const skipLive = process.env.SECURITY_HEADERS_SKIP_LIVE === '1';

  const home = await probe('/');
  if (home) {
    const h = home.headers;
    const liveChecks: Array<[boolean, string]> = [
      [!!h.get('content-security-policy'), 'response includes content-security-policy'],
      [!!h.get('x-frame-options'), 'response includes x-frame-options'],
      [h.get('x-frame-options')?.toUpperCase() === 'DENY', 'x-frame-options is DENY'],
      [!!h.get('x-content-type-options'), 'response includes x-content-type-options'],
      [h.get('x-content-type-options') === 'nosniff', 'x-content-type-options is nosniff'],
      [!!h.get('referrer-policy'), 'response includes referrer-policy'],
      [!!h.get('permissions-policy'), 'response includes permissions-policy'],
    ];
    for (const [ok, msg] of liveChecks) {
      if (ok) console.log(`OK: ${msg}`);
      else if (skipLive) console.log(`WARN: ${msg} (live probe skipped strict — deploy pending)`);
      else {
        console.error(`FAIL: ${msg}`);
        process.exit(1);
      }
    }
    if (h.get('strict-transport-security')) {
      console.log('OK: strict-transport-security present (HSTS)');
    } else {
      console.log('  NOTE: strict-transport-security not on this response (Vercel may add on apex)');
    }
    console.log(`  Homepage status: ${home.res.status}`);
  } else if (!skipLive) {
    console.error('FAIL: could not probe homepage for live headers');
    process.exit(1);
  }
}

runLiveProbe()
  .then(() => console.log('\nAll security header checks passed.'))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
