import { matchExplainerFromText } from './catalog';
import { assertSafeCopy } from './bannedLanguage';

export type OutreachAudience = 'smb_owner' | 'agency_owner' | 'technical_contact' | 'follow_up' | 're_engagement';

/** Translate raw scanner issue to business-first plain English — no raw dump. */
export function translateFindingForOutreach(issue: string): string {
  const ex = matchExplainerFromText(issue);
  if (ex) return ex.plainEnglish;

  const lower = issue.toLowerCase();
  if (/ssl|https|certificate/.test(lower)) {
    return 'We noticed HTTPS configuration that may need attention before visitors see trust warnings.';
  }
  if (/header|csp|hsts|x-frame|referrer|permissions/.test(lower)) {
    return 'Some standard browser security settings are not fully configured yet.';
  }
  if (/script|third.party|cdn/.test(lower)) {
    return 'Third-party scripts on the site may benefit from a quick review.';
  }
  if (/login|admin|auth/.test(lower)) {
    return 'Login-related pages are visible — worth confirming they follow your security baseline.';
  }
  return 'Our scan flagged a configuration item worth a quick review — happy to share details if useful.';
}

export function buildNoFindingsOutreachParagraph(businessName: string): string {
  const text = `We took a look at ${businessName}'s website and did not flag urgent issues on this pass. Many businesses still benefit from ongoing monitoring — certificates renew, plugins update, and small configuration changes can slip through between manual checks.`;
  assertSafeCopy(text, 'no-findings-outreach');
  return text;
}

export function audienceOpener(audience: OutreachAudience, businessName: string): string {
  switch (audience) {
    case 'agency_owner':
      return `I work with web and marketing agencies that monitor client sites for SSL, uptime, and configuration drift — ${businessName} came up in our regional discovery.`;
    case 'technical_contact':
      return `Quick note on ${businessName}'s site — we run passive security checks and I wanted to share one configuration item your team may want to glance at.`;
    case 'follow_up':
      return `Following up on my note about ${businessName} — still happy to share the monitoring summary if useful.`;
    case 're_engagement':
      return `Checking back in on ${businessName} — website monitoring is often bundled into care plans now, and I wanted to see if a lightweight check would help your team.`;
    case 'smb_owner':
    default:
      return `I help local businesses catch website issues before customers notice — ${businessName} stood out in our scan.`;
  }
}

export function businessValueClosing(planHint?: string): string {
  const plan = planHint ?? 'continuous monitoring with clear alerts';
  return `CyberShield Cloud offers ${plan} so you are not relying on quarterly manual checks alone.`;
}

export function formatFindingBulletsForOutreach(issues: string[], max = 2): string[] {
  const unique = [...new Set(issues.map(translateFindingForOutreach))];
  return unique.slice(0, max);
}

export function preserveTrackedLink(body: string, trackedUrl: string): string {
  if (body.includes(trackedUrl)) return body;
  return `${body.trim()}\n\nLearn more: ${trackedUrl}`;
}
