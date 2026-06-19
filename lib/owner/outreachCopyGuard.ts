import { BANNED_INTELLIGENCE_PHRASES } from '@/lib/intelligence/bannedLanguage';

export interface OutreachCopyGuardResult {
  ok: boolean;
  issues: string[];
}

const SCARY_PHRASES = [
  ...BANNED_INTELLIGENCE_PHRASES,
  'urgent security threat',
  'we found a breach',
  'guaranteed protection',
  'act now',
  'limited time',
  'you must',
  'immediate action required',
];

const RAW_SCANNER =
  /\bMissing (Content-Security-Policy|Referrer-Policy|Permissions-Policy|Strict-Transport-Security|X-Frame-Options|X-Content-Type-Options)\b/i;
const SEVERITY_TAG = /\[(critical|high|medium|low|info)\]/i;

function countLinks(text: string): number {
  return (text.match(/https?:\/\//gi) ?? []).length;
}

function countExclamations(text: string): number {
  return (text.match(/!/g) ?? []).length;
}

/** Block spamminess / fear copy before any outreach send. */
export function validateOutreachCopy(
  content: string,
  opts: { skipUnsubscribeCheck?: boolean } = {},
): OutreachCopyGuardResult {
  const issues: string[] = [];
  const body = content.replace(/^Subject:.*?(?:\n|$)/i, '').trim();
  const lower = content.toLowerCase();

  if (body.length > 2200) {
    issues.push('Email is too long — keep cold outreach under ~400 words.');
  }
  if (body.length < 80) {
    issues.push('Email body is too short to send meaningfully.');
  }

  const links = countLinks(content);
  if (links > 3) {
    issues.push(`Too many links (${links}) — use one clear CTA link.`);
  }

  if (countExclamations(content) > 2) {
    issues.push('Too many exclamation marks — keep tone calm.');
  }

  for (const phrase of SCARY_PHRASES) {
    if (lower.includes(phrase)) {
      issues.push(`Scary or spammy phrase detected: "${phrase}"`);
    }
  }

  if (SEVERITY_TAG.test(content)) {
    issues.push('Raw severity tags ([HIGH]) must not appear in customer email.');
  }
  if (RAW_SCANNER.test(body.slice(0, 400))) {
    issues.push('Raw scanner dump in opening — use plain-English business copy.');
  }

  if (!opts.skipUnsubscribeCheck && !/unsubscribe|opt out|stop receiving|reply stop/i.test(content)) {
    issues.push('Missing unsubscribe/opt-out language (added by template if HTML path).');
  }

  return { ok: issues.length === 0, issues };
}
