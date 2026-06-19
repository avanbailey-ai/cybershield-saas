import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  DMARC_RECORD_STAGE_1,
  EMAIL_LINKS_DOMAIN,
  EMAIL_SENDING_DOMAIN,
  EMAIL_TRACK_DOMAIN,
  getReplyToAddress,
  getResendFromAddress,
} from '../lib/email/config';
import { buildEmailDocument } from '../lib/email/template';
import { buildClickTrackingUrl, injectOpenPixel, signTrackingPayload } from '../lib/email/tracking';

const root = join(__dirname, '..');

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`OK: ${msg}`);
}

function exists(rel: string): boolean {
  return existsSync(join(root, rel));
}

function main() {
  assert(exists('docs/email-infrastructure-audit.md'), 'Audit document exists');
  assert(read('docs/email-infrastructure-audit.md').includes('DMARC'), 'Audit covers DMARC');

  const config = read('lib/email/config.ts');
  assert(config.includes('mail.cybershieldcloud.com'), 'Sending subdomain configured');
  assert(config.includes('links.cybershieldcloud.com'), 'Links tracking domain configured');
  assert(config.includes('track.cybershieldcloud.com'), 'Open tracking domain configured');
  assert(DMARC_RECORD_STAGE_1.includes('p=none'), 'DMARC stage 1 defined');

  assert(config.includes("'outreach'"), 'Outreach category in sender config');
  assert(config.includes('FROM_LOCAL'), 'Category sender map exists');
  assert(getReplyToAddress('outreach').includes('@'), 'Reply-to configured');

  const template = read('lib/email/template.ts');
  assert(template.includes('Privacy'), 'Footer includes privacy');
  assert(template.includes('Unsubscribe') || template.includes('STOP'), 'Footer includes unsubscribe');

  const doc = buildEmailDocument({
    title: 'Test',
    bodyHtml: '<p>Hello</p>',
    bodyText: 'Hello',
    category: 'outreach',
    reason: 'Test send',
  });
  assert(doc.html.includes('<!DOCTYPE html>'), 'HTML email renders');
  assert(doc.text.includes('CyberShield Cloud'), 'Plain text version included');
  assert(doc.text.length > 50, 'Plain text non-empty');

  const deliveryId = '00000000-0000-4000-8000-000000000001';
  const clickUrl = buildClickTrackingUrl(deliveryId, 'https://cybershieldcloud.com/signup');
  assert(clickUrl.includes('/api/email/click'), 'Click tracking URL built');
  assert(clickUrl.includes('d='), 'Click URL includes delivery id');

  const htmlWithPixel = injectOpenPixel('<html><body></body></html>', deliveryId);
  assert(htmlWithPixel.includes('/api/email/open'), 'Open pixel injected');

  assert(signTrackingPayload(deliveryId).length >= 8, 'Tracking signature generated');

  assert(exists('app/api/email/click/route.ts'), 'Click tracking route');
  assert(exists('app/api/email/open/route.ts'), 'Open tracking route');
  assert(exists('app/api/resend/webhook/route.ts'), 'Resend webhook route');

  assert(exists('lib/email/deliveryLog.ts'), 'Delivery logging module');
  assert(exists('lib/owner/emailHealth.ts'), 'Email health module');
  assert(exists('lib/owner/emailIntelligence.ts'), 'Email intelligence module');
  assert(exists('supabase/migrations/20260620100000_email_infrastructure.sql'), 'Email migration');

  const outreach = read('lib/owner/generators/outreach.ts');
  assert(!outreach.includes('[Your name]'), 'Outreach placeholder signature removed');
  assert(outreach.includes('CyberShield Cloud'), 'Outreach branded signature');

  const send = read('lib/email.ts');
  assert(send.includes('text:'), 'Send includes plain text support');
  assert(send.includes('replyTo'), 'Send includes reply-to');
  assert(send.includes('trackOpens'), 'Send supports open tracking');

  const execution = read('lib/owner/outreachExecution.ts');
  assert(execution.includes('buildEmailDocument'), 'Outreach uses standard template');
  assert(execution.includes('attributionToken'), 'Outreach logs attribution');

  const home = read('components/owner/views/FounderHomeView.tsx');
  assert(home.includes('EmailHealthSection'), 'Founder OS email health wired');
  assert(home.includes('EmailIntelligenceSection'), 'Founder OS email intelligence wired');

  assert(EMAIL_SENDING_DOMAIN === 'mail.cybershieldcloud.com', 'Sending domain constant');
  assert(EMAIL_LINKS_DOMAIN === 'links.cybershieldcloud.com', 'Links domain constant');
  assert(EMAIL_TRACK_DOMAIN === 'track.cybershieldcloud.com', 'Track domain constant');

  console.log('\nAll email infrastructure checks passed.');
}

main();
