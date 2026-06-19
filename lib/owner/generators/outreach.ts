import { matchExplainerFromText } from '@/lib/intelligence/catalog';
import { translateFindingForOutreach, buildNoFindingsOutreachParagraph } from '@/lib/intelligence/outreachCopy';

export interface OutreachInput {
  businessName: string;
  website: string;
  industry?: string;
  city?: string;
  scanScore?: number;
  riskLevel?: string;
  issues?: string[];
  contactName?: string;
  contactEmail?: string;
  signupUrl?: string;
  /** Override automatic variant selection */
  variant?: OutreachVariant;
}

export type OutreachType =
  | 'cold_email'
  | 'linkedin'
  | 'facebook'
  | 'follow_up'
  | 'agency_pitch'
  | 'audit_summary';

export type OutreachVariant = 'smb' | 'healthcare' | 'agency' | 'saas' | 'technical';

const TECH_EMAIL_PREFIXES = [
  'dev@',
  'developer@',
  'engineering@',
  'engineer@',
  'tech@',
  'it@',
  'webmaster@',
  'sysadmin@',
  'platform@',
  'cto@',
  'infrastructure@',
  'devops@',
  'security@',
  'ops@',
];

const TECH_TITLE_KEYWORDS = [
  'cto',
  'developer',
  'engineer',
  'devops',
  'it director',
  'tech lead',
  'web developer',
  'software',
  'systems admin',
];

export function isTechnicalContact(input: Pick<OutreachInput, 'contactEmail' | 'contactName'>): boolean {
  const email = (input.contactEmail ?? '').trim().toLowerCase();
  const name = (input.contactName ?? '').trim().toLowerCase();

  if (email && TECH_EMAIL_PREFIXES.some((prefix) => email.startsWith(prefix))) {
    return true;
  }
  if (name && TECH_TITLE_KEYWORDS.some((title) => name.includes(title))) {
    return true;
  }
  return false;
}

export function selectOutreachVariant(input: OutreachInput): OutreachVariant {
  if (input.variant) return input.variant;
  if (isTechnicalContact(input)) return 'technical';

  const key = `${input.industry ?? ''} ${input.businessName ?? ''}`.toLowerCase();

  if (/agency|agencies|marketing firm|web design|digital agency|creative agency/.test(key)) {
    return 'agency';
  }
  if (
    /health\s?care|\bmedical\b|\bdental\b|\bclinic\b|\bhospital\b|pharmacy|\bdoctor\b|physician/.test(
      key,
    )
  ) {
    return 'healthcare';
  }
  if (/\bsaas\b|software|startup|\bplatform\b|tech company|app company|b2b software/.test(key)) {
    return 'saas';
  }

  return 'smb';
}

/**
 * Calm reassurance so a non-technical owner does not read the email as an
 * accusation that they were hacked. Required in every findings-based email.
 */
export const SAFETY_DISCLAIMER =
  'Nothing here means your site is hacked or compromised. These are public website configuration items that are worth reviewing.';

/** Plain-English explanation of what CyberShield Cloud actually does. */
export const PRODUCT_EXPLANATION =
  'CyberShield Cloud monitors business websites for security settings, SSL certificate issues, domain problems, uptime changes, and unexpected website changes, so owners know when something important changes.';


export interface FindingTranslation {
  /** Plain-English, business-owner-facing description. No jargon. */
  business: string;
  /** Optional technical note for whoever manages the site. */
  technical: string;
}

/**
 * Translate a raw scanner finding into a business-first description plus an
 * optional technical note. Never returns raw severity tags or scanner strings.
 */
export function translateFinding(issue: string): FindingTranslation {
  const fromCatalog = matchExplainerFromText(issue);
  if (fromCatalog) {
    return {
      business: fromCatalog.plainEnglish,
      technical: fromCatalog.technicalExplanation,
    };
  }
  return {
    business: translateFindingForOutreach(issue),
    technical: issue.replace(/^\s*\[[A-Za-z]+\]\s*/, '').trim() || 'Configuration item flagged during the scan.',
  };
}

function translateIssueToBusiness(issue: string): string {
  return translateFinding(issue).business;
}

function businessFindingSummary(input: OutreachInput): string {
  const count = input.issues?.length ?? 0;
  if (count >= 3) {
    return 'several areas on the public site that could create security or reliability risk if left unaddressed';
  }
  if (count >= 1) {
    return 'a few areas on the public site that could create security or reliability risk if left unaddressed';
  }
  if (input.scanScore !== undefined && input.scanScore < 70) {
    return 'configuration gaps worth addressing before they affect customers or day-to-day operations';
  }
  return 'areas on the public site worth a closer look from a security and reliability standpoint';
}

function businessImpactLines(input: OutreachInput, max = 2): string[] {
  const issues = input.issues ?? [];
  if (issues.length === 0) {
    return [
      'Small website configuration gaps often go unnoticed until a certificate expires, a vendor update changes a setting, or a customer reports a problem.',
    ];
  }
  return issues.slice(0, max).map((issue) => translateIssueToBusiness(issue));
}

function lowPressureCta(input: OutreachInput): string {
  if (input.signupUrl) {
    return `Would you like me to send over the short scan summary? You can also review what was flagged here: ${input.signupUrl}`;
  }
  return 'Want me to send the quick summary so whoever manages the site can review it? No pressure either way.';
}

function monitoringPitch(): string {
  return (
    `${PRODUCT_EXPLANATION} ` +
    "It's continuous monitoring — not a one-time scan — so you find out when something changes before it becomes a problem."
  );
}

/**
 * Top findings translated into plain, non-technical language, followed by the
 * calm "not hacked" disclaimer. Returns '' when there are no specific findings.
 */
function translatedFindingsBlock(input: OutreachInput, max = 3): string {
  const issues = input.issues ?? [];
  if (issues.length === 0) return '';
  const seen = new Set<string>();
  const bullets: string[] = [];
  for (const issue of issues) {
    const line = translateFinding(issue).business;
    if (seen.has(line)) continue;
    seen.add(line);
    bullets.push(`• ${line}`);
    if (bullets.length >= max) break;
  }
  return `In plain terms, here is what stood out:\n${bullets.join('\n')}`;
}

/** Optional technical detail section — translated notes, never raw scanner tags. */
function optionalTechnicalNotes(input: OutreachInput, max = 6): string {
  const issues = input.issues ?? [];
  if (issues.length === 0) return '';
  const seen = new Set<string>();
  const notes: string[] = [];
  for (const issue of issues) {
    const note = translateFinding(issue).technical;
    if (seen.has(note)) continue;
    seen.add(note);
    notes.push(`${notes.length + 1}. ${note}`);
    if (notes.length >= max) break;
  }
  return `Optional technical detail (for whoever manages the site):\n${notes.join('\n')}`;
}

function continuousMonitoringWhy(): string {
  return (
    'Most businesses never know when a setting changes, a certificate is about to expire, ' +
    'or a third-party tool introduces new risk — until something breaks or a customer notices. ' +
    'CyberShield watches continuously so problems surface early, not after the fact.'
  );
}

function buildSubject(variant: OutreachVariant, input: OutreachInput): string {
  switch (variant) {
    case 'healthcare':
      return `${input.businessName} — website monitoring note`;
    case 'agency':
      return `${input.businessName} — client site monitoring`;
    case 'saas':
      return `${input.businessName} — website reliability note`;
    case 'technical':
      return `${input.businessName} — scan findings (business impact + details)`;
    default:
      return `${input.businessName} — quick note about your website`;
  }
}

function buildTechnicalFindingsBlock(input: OutreachInput): string {
  const notes = optionalTechnicalNotes(input);
  if (!notes) return '';
  const scoreLine =
    input.scanScore !== undefined ? `\nOverall scan score: ${input.scanScore}/100` : '';
  return `${notes}${scoreLine}`;
}

type VariantCopy = {
  whyReachingOut: (input: OutreachInput) => string;
  whyItMatters: (input: OutreachInput) => string;
  whatCyberShieldDoes: (input: OutreachInput) => string;
  whyDifferent: (input: OutreachInput) => string;
};

const VARIANT_COPY: Record<OutreachVariant, VariantCopy> = {
  smb: {
    whyReachingOut: (input) =>
      `I'm reaching out because CyberShield Cloud recently reviewed ${input.website} as part of our work helping local businesses keep an eye on their website health. ` +
      `The review surfaced ${businessFindingSummary(input)}.`,
    whyItMatters: (input) =>
      `For a business like ${input.businessName}, small website issues like these usually show up as lost leads, interrupted online orders, or customers seeing browser warnings before they ever reach you — and they often go unnoticed until they become a problem.`,
    whatCyberShieldDoes: () => monitoringPitch(),
    whyDifferent: () => continuousMonitoringWhy(),
  },

  healthcare: {
    whyReachingOut: (input) =>
      `I'm reaching out because CyberShield Cloud reviewed ${input.website} while helping practices and healthcare organizations keep an eye on their public website. ` +
      `The review surfaced ${businessFindingSummary(input)}.`,
    whyItMatters: (input) =>
      `For ${input.businessName}, website reliability and trust affect whether patients feel confident booking online, completing forms, or coming back to your site — so quiet configuration issues can quietly cost you appointments.`,
    whatCyberShieldDoes: () =>
      monitoringPitch() +
      ' For practices, that means fewer surprises around site availability, certificate expiration, and settings patients never see but still feel.',
    whyDifferent: () =>
      continuousMonitoringWhy() +
      ' In healthcare, those changes often surface only after a patient reports trouble or an online form stops working.',
  },

  agency: {
    whyReachingOut: (input) =>
      `I'm reaching out because CyberShield Cloud reviewed ${input.website} while working with agencies that manage websites for multiple clients. ` +
      `The review surfaced ${businessFindingSummary(input)}.`,
    whyItMatters: (input) =>
      `For an agency like ${input.businessName}, issues like these can turn into client escalations, renewal risk, or fire drills that pull your team away from billable work — usually at the worst possible time.`,
    whatCyberShieldDoes: () =>
      monitoringPitch() +
      ' Agencies use it to keep an eye on client sites continuously, without waiting for the next manual audit.',
    whyDifferent: () =>
      'Most agencies only catch website drift when a client reports an issue, a certificate expires, or a launch changes a setting without anyone noticing. ' +
      'Continuous monitoring means your team sees those changes early.',
  },

  saas: {
    whyReachingOut: (input) =>
      `I'm reaching out because CyberShield Cloud reviewed ${input.website} as part of our work with software and SaaS companies keeping an eye on their public-facing sites. ` +
      `The review surfaced ${businessFindingSummary(input)}.`,
    whyItMatters: (input) =>
      `For ${input.businessName}, your public site affects signup conversion and customer trust — and issues like these often surface from a prospect or a support ticket long before anyone on the team notices.`,
    whatCyberShieldDoes: () =>
      monitoringPitch() +
      ' For SaaS teams, that means catching certificate, settings, and uptime changes outside your normal deploy cycle.',
    whyDifferent: () =>
      continuousMonitoringWhy() +
      ' Product teams often learn about public-site issues from a prospect, a screenshot, or an expired certificate — not from proactive monitoring.',
  },

  technical: {
    whyReachingOut: (input) =>
      `I'm reaching out because CyberShield Cloud reviewed ${input.website} and surfaced ${businessFindingSummary(input)}. ` +
      `I'll keep the business impact up top and put the technical notes lower down for whoever manages the site.`,
    whyItMatters: (input) =>
      `For ${input.businessName}, even when the underlying fix is technical, the business outcome is usually downtime risk, trust erosion, or slower incident response if it goes unnoticed.`,
    whatCyberShieldDoes: () =>
      monitoringPitch() +
      ' You get continuous visibility into SSL, settings, uptime, domain expiration, and configuration drift, with alerts when something changes.',
    whyDifferent: () =>
      'Most teams only revisit public-site security during launches, audits, or incidents. Continuous monitoring means drift and expiration do not depend on someone remembering to check.',
  },
};

function hasEcommerceEvidence(input: OutreachInput): boolean {
  const key = `${input.industry ?? ''} ${input.businessName ?? ''} ${input.website ?? ''}`.toLowerCase();
  return /\b(e-?commerce|online store|online shop|online order|woocommerce|shopify)\b/i.test(key);
}

function businessImpactLine(input: OutreachInput): string {
  if (selectOutreachVariant(input) === 'healthcare') {
    return `For ${input.businessName}, website reliability affects patient trust and online scheduling — quiet configuration issues can surface before your team notices.`;
  }
  if (hasEcommerceEvidence(input)) {
    return `For ${input.businessName}, these configuration gaps can affect customer trust, checkout reliability, and how smoothly online orders run.`;
  }
  if (selectOutreachVariant(input) === 'agency') {
    return `For ${input.businessName}, issues like these can create client escalations or pull your team into unplanned fixes.`;
  }
  return `For ${input.businessName}, small website configuration gaps often go unnoticed until a certificate expires or a customer reports a problem.`;
}

function buildColdEmail(variant: OutreachVariant, input: OutreachInput): string {
  const greeting = `Hi${input.contactName ? ` ${input.contactName}` : ''},`;
  const findingsBlock = translatedFindingsBlock(input, 3);
  const whyLine = `I'm reaching out because we reviewed ${input.website} and noticed ${businessFindingSummary(input)}.`;

  const body = [
    greeting,
    '',
    whyLine,
    SAFETY_DISCLAIMER,
    '',
    findingsBlock,
    findingsBlock ? '' : null,
    businessImpactLine(input),
    '',
    `${PRODUCT_EXPLANATION} Continuous monitoring helps catch certificate, settings, and uptime changes early — from $79/mo for one business site.`,
    '',
    lowPressureCta(input),
    '',
    '— CyberShield Cloud',
  ]
    .filter((section): section is string => section !== null && section !== undefined)
    .filter((section, idx, arr) => !(section === '' && arr[idx - 1] === ''))
    .join('\n');

  return `Subject: ${buildSubject(variant, input)}\n\n${body}`;
}

function buildFollowUp(input: OutreachInput, variant: OutreachVariant): string {
  const greeting = `Hi${input.contactName ? ` ${input.contactName}` : ''},`;
  const reminder =
    input.scanScore !== undefined
      ? `Your site scored ${input.scanScore}/100 on our last review — a few items are still worth addressing before they affect customers or uptime.`
      : `Wanted to follow up briefly on our note about ${input.website}. The findings are still relevant.`;

  return `Subject: Re: ${input.businessName} — website monitoring

${greeting}

Following up briefly — ${reminder}

${monitoringPitch()}

${SAFETY_DISCLAIMER}

${lowPressureCta(input)}

— CyberShield Cloud`;
}

function buildLinkedIn(input: OutreachInput): string {
  const variant = selectOutreachVariant(input);
  const summary = businessFindingSummary(input);
  return `Hi — I help ${input.industry ?? 'businesses'} keep websites monitored between audits, not just scanned once.

I reviewed ${input.website} and found ${summary}.

${lowPressureCta(input)}`;
}

function buildFacebook(input: OutreachInput): string {
  const summary = businessFindingSummary(input);
  return `${input.businessName} team — quick note on ${input.website}.

We identified ${summary} during a recent review. ${continuousMonitoringWhy()}

Reply if you'd like the scan summary.`;
}

function buildAgencyPitch(input: OutreachInput): string {
  return `Subject: Continuous monitoring for ${input.businessName} client sites

Hi${input.contactName ? ` ${input.contactName}` : ''},

I'm reaching out because agencies like ${input.businessName} often manage dozens of client websites — and most only learn about an expiring certificate, a changed setting, or downtime when a client calls.

${monitoringPitch()} You keep the client relationship; we handle the ongoing watch across client sites.

We reviewed ${input.website} and found ${businessFindingSummary(input)} as an example of what continuous monitoring catches early.

${SAFETY_DISCLAIMER}

${lowPressureCta(input)}

— CyberShield Cloud
Website monitoring & security intelligence`;
}

function buildAuditSummary(input: OutreachInput): string {
  const impacts = businessImpactLines(input, 3);
  const technical = optionalTechnicalNotes(input);
  const technicalBlock = technical ? `\n${technical}\n` : '';

  return `WEBSITE REVIEW — ${input.businessName}
Website: ${input.website}
${input.scanScore !== undefined ? `Score: ${input.scanScore}/100` : ''}

Business impact summary:
${impacts.map((line) => `• ${line}`).join('\n')}
${technicalBlock}
${SAFETY_DISCLAIMER}

CyberShield Cloud — continuous website monitoring & security intelligence`;
}

const TEMPLATES: Record<OutreachType, (input: OutreachInput) => string> = {
  cold_email: (input) => buildColdEmail(selectOutreachVariant(input), input),
  follow_up: (input) => buildFollowUp(input, selectOutreachVariant(input)),
  linkedin: buildLinkedIn,
  facebook: buildFacebook,
  agency_pitch: buildAgencyPitch,
  audit_summary: buildAuditSummary,
};

export function generateOutreach(type: OutreachType, input: OutreachInput): string {
  return TEMPLATES[type](input);
}

export const OUTREACH_VARIANTS: { id: OutreachVariant; label: string }[] = [
  { id: 'smb', label: 'SMB (default)' },
  { id: 'healthcare', label: 'Healthcare' },
  { id: 'agency', label: 'Agency' },
  { id: 'saas', label: 'SaaS' },
  { id: 'technical', label: 'Technical recipient' },
];

export const OUTREACH_TYPES: { id: OutreachType; label: string }[] = [
  { id: 'cold_email', label: 'Cold Email' },
  { id: 'linkedin', label: 'LinkedIn Message' },
  { id: 'facebook', label: 'Facebook DM' },
  { id: 'follow_up', label: 'Follow-up' },
  { id: 'agency_pitch', label: 'Agency Pitch' },
  { id: 'audit_summary', label: 'Audit Summary' },
];
