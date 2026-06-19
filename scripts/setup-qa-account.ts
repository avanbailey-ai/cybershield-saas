/**
 * Idempotent QA customer account setup (requires service role key).
 *
 * Ensures test@gmail.com (or QA_ACCOUNT_EMAIL) exists, is flagged is_qa_account,
 * has org membership, org subscription row, and a known password.
 *
 * Usage:
 *   QA_RESET_PASSWORD='YourSecurePassword123!' npx tsx scripts/setup-qa-account.ts
 *
 * Optional:
 *   QA_ACCOUNT_EMAIL=test@gmail.com
 *   QA_SIMULATED_PLAN=agency|pro|growth
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal(): void {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
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
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const email = (process.env.QA_ACCOUNT_EMAIL ?? 'test@gmail.com').trim().toLowerCase();
const password = process.env.QA_RESET_PASSWORD?.trim();
const simulatedPlan = (process.env.QA_SIMULATED_PLAN ?? 'agency').trim().toLowerCase();

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }
  if (!password || password.length < 8) {
    console.error('Set QA_RESET_PASSWORD (min 8 chars) before running setup.');
    process.exit(1);
  }
  if (!['pro', 'growth', 'agency'].includes(simulatedPlan)) {
    console.error('QA_SIMULATED_PLAN must be pro, growth, or agency.');
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let userId: string | null = null;
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users.find((u) => u.email?.toLowerCase() === email);

  if (existing) {
    userId = existing.id;
    await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    console.log(`Updated password for existing user ${email}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) throw error ?? new Error('createUser failed');
    userId = data.user.id;
    console.log(`Created auth user ${email}`);
  }

  await admin.from('profiles').upsert({
    id: userId,
    email,
    is_qa_account: true,
    qa_simulated_plan: simulatedPlan,
    qa_enterprise_enabled: false,
    updated_at: new Date().toISOString(),
  });

  const { data: profile } = await admin
    .from('profiles')
    .select('default_org_id')
    .eq('id', userId)
    .single();

  let orgId = profile?.default_org_id as string | null;
  if (!orgId) {
    const { data: org, error: orgErr } = await admin
      .from('organizations')
      .insert({
        name: `${email.split('@')[0]}'s Organization`,
        owner_id: userId,
        plan: 'free',
        seat_limit: 5,
      })
      .select('id')
      .single();
    if (orgErr || !org) throw orgErr ?? new Error('org insert failed');
    orgId = org.id as string;

    await admin.from('organization_members').upsert({
      org_id: orgId,
      user_id: userId,
      role: 'owner',
    });

    await admin.from('profiles').update({ default_org_id: orgId }).eq('id', userId);
    console.log(`Created org ${orgId}`);
  }

  await admin.from('organization_subscriptions').upsert({
    org_id: orgId,
    plan: simulatedPlan,
    status: 'active',
    updated_at: new Date().toISOString(),
  });

  console.log('\nQA account ready.');
  console.log(`  Email: ${email}`);
  console.log(`  Simulated plan: ${simulatedPlan}`);
  console.log(`  Login: https://cybershieldcloud.com/login`);
  console.log('  Password: (value you set in QA_RESET_PASSWORD — not printed)');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
