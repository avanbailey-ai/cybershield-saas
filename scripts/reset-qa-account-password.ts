/**
 * Reset password for a QA-flagged account (admin only — requires service role key).
 *
 * Option A — set password directly:
 *   QA_RESET_PASSWORD='YourNewPassword123!' npx tsx scripts/reset-qa-account-password.ts
 *
 * Option B — print a one-time recovery link (no password in shell history):
 *   npx tsx scripts/reset-qa-account-password.ts --link
 *
 * Optional: QA_ACCOUNT_EMAIL=test@gmail.com (default: test@gmail.com)
 */

import { createClient } from '@supabase/supabase-js';
import { resolveSiteUrl } from '../lib/site/getSiteUrl';

const email = (process.env.QA_ACCOUNT_EMAIL ?? 'test@gmail.com').trim().toLowerCase();
const newPassword = process.env.QA_RESET_PASSWORD?.trim();
const wantLink = process.argv.includes('--link');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw listErr;

  const user = list.users.find((u) => u.email?.toLowerCase() === email);
  if (!user) {
    console.error(`No auth user found for ${email}. Sign up first, then re-run.`);
    process.exit(1);
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('is_qa_account')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.is_qa_account) {
    console.error(
      `Refusing: ${email} is not flagged is_qa_account=true. Only QA test accounts can be reset via this script.`,
    );
    process.exit(1);
  }

  if (wantLink || !newPassword) {
    const siteUrl = resolveSiteUrl();
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${siteUrl}/auth/callback` },
    });
    if (error) throw error;

    const link = data.properties?.action_link;
    if (!link) {
      console.error('Recovery link not returned. Use Supabase Dashboard → Authentication → Users → Send password recovery.');
      process.exit(1);
    }

    console.log(`Recovery link for ${email} (open in browser, set a new password):`);
    console.log(link);
    console.log('\nNote: CyberShield has no in-app forgot-password page yet; use the link above or set QA_RESET_PASSWORD and re-run without --link.');
    return;
  }

  if (newPassword.length < 8) {
    console.error('QA_RESET_PASSWORD must be at least 8 characters.');
    process.exit(1);
  }

  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });
  if (error) throw error;

  console.log(`Password updated for ${email}. Log in at /login with the new password.`);
  console.log('(Password was not printed — you set it via QA_RESET_PASSWORD.)');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
