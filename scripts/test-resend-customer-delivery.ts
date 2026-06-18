/**
 * Verify Resend can deliver to a non-owner (customer) inbox.
 *
 * Usage:
 *   RESEND_API_KEY=re_... EMAIL_FROM="CyberShield <alerts@cybershieldcloud.com>" \
 *     npx tsx scripts/test-resend-customer-delivery.ts customer@example.com
 *
 * Or add RESEND_API_KEY + EMAIL_FROM to .env.local and pass only the recipient.
 */

import fs from 'fs';
import path from 'path';
import { sendEmail, getResendFromAddress, isResendSandboxFrom } from '../lib/email';

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

  const to = process.argv[2]?.trim() || process.env.RESEND_TEST_TO?.trim();
  if (!to) {
    console.error('Usage: npx tsx scripts/test-resend-customer-delivery.ts <recipient@email.com>');
    process.exit(1);
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set (.env.local or env).');
    process.exit(1);
  }

  const from = getResendFromAddress();
  const sandbox = isResendSandboxFrom(from);

  console.log(`From:    ${from}`);
  console.log(`To:      ${to}`);
  console.log(`Sandbox: ${sandbox ? 'yes (customer delivery will likely fail)' : 'no'}`);

  if (sandbox) {
    console.warn(
      '\nSet EMAIL_FROM to your verified domain, e.g. CyberShield <alerts@cybershieldcloud.com>',
    );
  }

  const result = await sendEmail({
    to,
    subject: 'CyberShield — customer delivery test',
    html: `<p>If you received this, Resend customer delivery works from <strong>${from}</strong>.</p>`,
  });

  if (result.success) {
    console.log(`\nSent. messageId=${result.messageId}`);
    if (sandbox) {
      console.log('Note: sandbox from may still only reach your Resend account email.');
    }
    process.exit(0);
  }

  console.error(`\nFailed: ${result.error}`);
  process.exit(1);
}

main();
