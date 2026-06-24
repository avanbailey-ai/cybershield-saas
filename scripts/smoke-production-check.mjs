#!/usr/bin/env node
/**
 * Production smoke tests for CyberShield (read-only, no destructive ops).
 *
 * Environment:
 *   SMOKE_BASE_URL        — target origin (default: production Vercel, then localhost)
 *   SMOKE_TEST_URL        — alias for SMOKE_BASE_URL
 *   SMOKE_SESSION_COOKIE  — optional Cookie header for authenticated /api/user/plan checks
 *
 * Usage:
 *   npm run smoke:production
 *   SMOKE_BASE_URL=https://cybershieldcloud.com node scripts/smoke-production-check.mjs
 *
 * Authenticated plan shape (optional):
 *   SMOKE_SESSION_COOKIE="sb-...-auth-token=..." npm run smoke:production
 *
 * Daily scan limit enforcement (403 SCAN_LIMIT_EXCEEDED) requires an authenticated
 * session at limit — not exercised here to avoid queueing scans in production.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const BASE_URL = (
  process.env.SMOKE_BASE_URL ||
  process.env.SMOKE_TEST_URL ||
  'https://cybershieldcloud.com' ||
  'http://localhost:3000'
).replace(/\/$/, '');

const SESSION_COOKIE = process.env.SMOKE_SESSION_COOKIE?.trim() || '';
const REQUEST_TIMEOUT_MS = 30_000;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function pass(name) {
  console.log(`PASS: ${name}`);
}

function fail(name, reason) {
  console.error(`FAIL: ${name} — ${reason}`);
  console.error('SMOKE_PRODUCTION_FAILED');
  process.exit(1);
}

async function request(pathname, options = {}) {
  const url = new URL(pathname, `${BASE_URL}/`).toString();
  const headers = { ...(options.headers ?? {}) };
  if (SESSION_COOKIE && !headers.Cookie) {
    headers.Cookie = SESSION_COOKIE;
  }

  const res = await fetch(url, {
    ...options,
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const contentType = res.headers.get('content-type') ?? '';
  let body;
  if (contentType.includes('application/json')) {
    try {
      body = await res.json();
    } catch {
      body = null;
    }
  } else {
    body = await res.text();
  }

  return { status: res.status, headers: res.headers, body, url };
}

async function followRedirects(pathname, options = {}) {
  const chain = [];
  let target = pathname;

  for (let i = 0; i < 6; i += 1) {
    const res = await request(target, { ...options, redirect: 'manual' });
    chain.push(res);

    const location = res.headers.get('location');
    if (!REDIRECT_STATUSES.has(res.status) || !location) {
      return chain;
    }

    target = new URL(location, res.url).toString();
  }

  return chain;
}

async function checkUserPlan() {
  const name = 'user-plan';
  const { status, body } = await request('/api/user/plan');

  if (SESSION_COOKIE) {
    if (status !== 200) {
      fail(name, `expected 200 with SMOKE_SESSION_COOKIE, got ${status}`);
    }
    if (!body || typeof body !== 'object') {
      fail(name, 'expected JSON body');
    }
    if (typeof body.plan !== 'string' || !body.plan) {
      fail(name, 'missing or invalid plan field');
    }
    if ('orgRole' in body && body.orgRole !== null && typeof body.orgRole !== 'string') {
      fail(name, 'orgRole must be string or null when present');
    }
    pass(name);
    return;
  }

  if (status !== 401) {
    fail(name, `unauthenticated expected 401, got ${status}`);
  }
  if (!body || body.error !== 'Unauthorized') {
    fail(name, 'expected { error: "Unauthorized" }');
  }
  pass(name);
}

async function checkScanTriggerLimit() {
  const name = 'scan-trigger-limit';

  const trigger = await request('/api/scan/trigger-all', { method: 'POST' });
  if (trigger.status === 500) {
    fail(name, 'POST /api/scan/trigger-all crashed with 500');
  }
  if (trigger.status !== 401) {
    fail(name, `unauthenticated trigger-all expected 401, got ${trigger.status}`);
  }
  if (!trigger.body || trigger.body.error !== 'Unauthorized') {
    fail(name, 'trigger-all expected { error: "Unauthorized" }');
  }

  const pub = await request('/api/scan/public', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'not-a-valid-url' }),
  });
  if (pub.status === 500) {
    fail(name, 'POST /api/scan/public crashed with 500');
  }
  if (pub.status !== 400) {
    fail(name, `public scan with invalid url expected 400, got ${pub.status}`);
  }
  if (!pub.body || !pub.body.error) {
    fail(name, 'public scan expected JSON error field');
  }

  pass(name);
}

async function checkStripeWebhook() {
  const name = 'stripe-webhook';

  const res = await request('/api/stripe/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': 't=0,v1=invalid_smoke_test_signature',
    },
    body: JSON.stringify({ id: 'evt_smoke_test', type: 'ping' }),
  });

  if (res.status === 500) {
    fail(name, 'webhook crashed with 500 on invalid signature');
  }
  if (res.status !== 400) {
    fail(name, `invalid signature expected 400, got ${res.status}`);
  }
  if (!res.body || res.body.error !== 'Invalid signature') {
    fail(name, 'expected { error: "Invalid signature" }');
  }

  pass(name);
}

async function checkEnterprisePortal() {
  const name = 'enterprise-portal';

  const chain = await followRedirects('/enterprise/portal');
  const res = chain[chain.length - 1];

  if (chain.some((step) => step.status === 500)) {
    fail(name, 'GET /enterprise/portal returned 500');
  }

  if (REDIRECT_STATUSES.has(res.status)) {
    fail(name, `redirect chain did not settle after ${chain.length} hops`);
  }

  if (res.status !== 200) {
    fail(name, `unauthenticated login page expected 200, got ${res.status}`);
  }

  if (!res.url.includes('/enterprise/login') && !res.url.includes('/login')) {
    fail(name, `expected final redirect target to be login, got url=${res.url}`);
  }

  pass(name);
}

function checkTypeScript() {
  const name = 'typescript';

  const result = spawnSync('npx', ['tsc', '--noEmit'], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || 'tsc failed').trim().split('\n')[0];
    fail(name, detail);
  }

  pass(name);
}

async function main() {
  console.log(`Smoke target: ${BASE_URL}`);
  if (SESSION_COOKIE) {
    console.log('Using SMOKE_SESSION_COOKIE for authenticated plan check');
  }

  await checkUserPlan();
  await checkScanTriggerLimit();
  await checkStripeWebhook();
  await checkEnterprisePortal();
  checkTypeScript();

  console.log('SMOKE_PRODUCTION_OK');
}

main().catch((err) => {
  console.error(`FAIL: smoke-runner — ${err instanceof Error ? err.message : String(err)}`);
  console.error('SMOKE_PRODUCTION_FAILED');
  process.exit(1);
});
