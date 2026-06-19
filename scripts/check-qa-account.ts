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

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing Supabase env');
    process.exit(1);
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = (process.env.QA_ACCOUNT_EMAIL ?? 'test@gmail.com').trim().toLowerCase();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;

  const user = data.users.find((u) => u.email?.toLowerCase() === email);
  console.log('user:', user ? { id: user.id, email: user.email, confirmed: user.email_confirmed_at } : 'NOT FOUND');

  if (!user) return;

  const { data: profile } = await admin
    .from('profiles')
    .select('is_qa_account, qa_simulated_plan, qa_enterprise_enabled, default_org_id, plan')
    .eq('id', user.id)
    .maybeSingle();
  console.log('profile:', profile);

  const { data: memberships } = await admin
    .from('organization_members')
    .select('org_id, role')
    .eq('user_id', user.id);
  console.log('memberships:', memberships);

  if (profile?.default_org_id) {
    const { data: sub } = await admin
      .from('organization_subscriptions')
      .select('plan, status')
      .eq('org_id', profile.default_org_id)
      .maybeSingle();
    console.log('subscription:', sub);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
