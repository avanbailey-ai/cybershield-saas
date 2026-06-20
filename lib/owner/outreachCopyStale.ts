import { SAFETY_DISCLAIMER } from './generators/outreach';
import { parseOutreachDraftContent } from './outreachDraftDisplay';

/** Bump when outreach template / copy guard rules change materially. */
export const OUTREACH_COPY_RULES_VERSION = '2026-06-20-short-v1';

const SEVERITY_TAG = /\[(critical|high|medium|low|info)\]/i;

/** Patterns from the pre-2026-06-20 long template that should be regenerated. */
const STALE_MARKERS: RegExp[] = [
  /interrupted online orders/i,
  /lost leads, interrupted online orders/i,
  /Most businesses never know when a setting changes/i,
  /Optional technical detail \(for whoever manages the site\)/i,
  /I'll keep the business impact up top and put the technical notes lower down/i,
  /several areas on the public site that could create security or reliability risk[\s\S]{0,400}CyberShield Cloud monitors business websites[\s\S]{0,400}CyberShield Cloud monitors business websites/i,
];

export function isOutreachDraftStale(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return true;

  const { body } = parseOutreachDraftContent(trimmed);
  const opening = body.split(/\n\s*\n/).map((p) => p.trim()).find(Boolean) ?? '';

  if (trimmed.length > 1600) return true;
  if (!trimmed.includes(SAFETY_DISCLAIMER) && !/hacked or compromised/i.test(trimmed)) return true;
  if (SEVERITY_TAG.test(opening)) return true;
  if (/\bMissing (Content-Security-Policy|Strict-Transport-Security|X-Frame-Options)\b/i.test(opening)) {
    return true;
  }

  for (const pattern of STALE_MARKERS) {
    if (pattern.test(trimmed)) return true;
  }

  const productMentions = trimmed.match(/CyberShield Cloud monitors business websites/gi)?.length ?? 0;
  if (productMentions > 1) return true;

  const continuousMentions = trimmed.match(/continuous monitoring/gi)?.length ?? 0;
  if (continuousMentions > 2) return true;

  if (!/opt out|unsubscribe|rather not receive|reply and tell me/i.test(trimmed)) return true;

  return false;
}

export function staleOutreachDraftLabel(content: string): string | null {
  if (!isOutreachDraftStale(content)) return null;
  return `Regenerate recommended — copy rules updated (${OUTREACH_COPY_RULES_VERSION})`;
}
