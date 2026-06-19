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
  if (/healthcare|medical|dental|clinic|hospital|pharmacy|doctor|physician|health care/.test(key)) {
    return 'healthcare';
  }
  if (/saas|software|startup|platform|tech company|app company|b2b software/.test(key)) {
    return 'saas';
  }

  return 'smb';
}

function translateIssueToBusiness(issue: string): string {
  const lower = issue.toLowerCase();

  if (/content-security-policy|\bcsp\b/.test(lower)) {
    return 'Your site may not have clear rules about which scripts and resources are allowed to run — which can leave visitors more exposed if something malicious gets injected.';
  }
  if (/strict-transport-security|\bhsts\b/.test(lower)) {
    return 'Visitors may not always be directed to the secure version of your site, which can create windows where traffic is more vulnerable.';
  }
  if (/x-frame-options|clickjack/.test(lower)) {
    return 'Your site may be easier to embed on untrusted pages, which can put visitors at risk of deceptive interactions.';
  }
  if (/x-content-type|content-type-options/.test(lower)) {
    return 'Browsers may not be given enough guidance to treat uploaded or linked files safely, which can increase exposure to certain attacks.';
  }
  if (/referrer-policy/.test(lower)) {
    return 'Information about where visitors came from may leak more than intended when they move between pages.';
  }
  if (/permissions-policy/.test(lower)) {
    return 'Your site may not be limiting access to sensitive browser features that third-party scripts could misuse.';
  }
  if (/ssl|https|certificate|tls/.test(lower)) {
    if (/expir/.test(lower)) {
      return 'Your security certificate timing may leave a window where browsers warn visitors — which can erode trust and interrupt bookings or purchases.';
    }
    if (/no https|plaintext/.test(lower)) {
      return 'Traffic to your site may not always be encrypted, which can expose customer information and trigger browser warnings.';
    }
    return 'Certificate or encryption settings may need attention before they affect customer trust or site availability.';
  }
  if (/could not reach|unreachable|server error|client error|http [45]/.test(lower)) {
    return 'There may be reliability issues affecting whether customers can reach your site consistently.';
  }

  return 'This is a configuration gap that often goes unnoticed until it affects customers, uptime, or trust.';
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
    return `Would you like the full scan summary? You can review what was flagged here: ${input.signupUrl}`;
  }
  return "Happy to send over the full scan summary if you'd like to see what was flagged — no pressure either way.";
}

function monitoringPitch(): string {
  return (
    'CyberShield provides continuous website monitoring — not a one-time scan. ' +
    'We watch security settings, SSL certificates, uptime, header changes, domain expiration, and new risks as they appear. ' +
    'We help businesses know when something changes before it becomes a problem.'
  );
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
  const issues = input.issues ?? [];
  if (issues.length === 0) return '';

  const lines = issues.slice(0, 6).map((issue, idx) => `${idx + 1}. ${issue}`);
  const scoreLine =
    input.scanScore !== undefined ? `\nOverall scan score: ${input.scanScore}/100` : '';

  return `\n--- Technical findings (for your reference) ---\n${lines.join('\n')}${scoreLine}`;
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
      `I'm reaching out because CyberShield recently reviewed ${input.website} as part of our work helping local businesses understand their website health. ` +
      `Our scan identified ${businessFindingSummary(input)}.`,
    whyItMatters: (input) => {
      const impacts = businessImpactLines(input);
      return (
        'Why it matters:\n' +
        impacts
          .map(
            (line) =>
              `${line} For a business like ${input.businessName}, that can mean lost leads, interrupted online orders, or customers seeing browser warnings before they ever reach you.`,
          )
          .join('\n\n')
      );
    },
    whatCyberShieldDoes: () => monitoringPitch(),
    whyDifferent: () => continuousMonitoringWhy(),
  },

  healthcare: {
    whyReachingOut: (input) =>
      `I'm reaching out because CyberShield reviewed ${input.website} while helping practices and healthcare organizations monitor their public web presence. ` +
      `Our scan identified ${businessFindingSummary(input)}.`,
    whyItMatters: (input) => {
      const impacts = businessImpactLines(input);
      return (
        'Why it matters:\n' +
        impacts
          .map(
            (line) =>
              `${line} For ${input.businessName}, website reliability and trust affect whether patients feel confident booking online, completing forms, or returning to your site.`,
          )
          .join('\n\n')
      );
    },
    whatCyberShieldDoes: () =>
      monitoringPitch() +
      ' For healthcare organizations, that means fewer surprises around site availability, certificate expiration, and security settings that patients never see — but that affect their experience.',
    whyDifferent: () =>
      continuousMonitoringWhy() +
      ' In healthcare, those changes often surface only after a patient reports trouble or an online workflow stops working.',
  },

  agency: {
    whyReachingOut: (input) =>
      `I'm reaching out because CyberShield reviewed ${input.website} while working with agencies that manage websites for multiple clients. ` +
      `Our scan identified ${businessFindingSummary(input)}.`,
    whyItMatters: (input) => {
      const impacts = businessImpactLines(input);
      return (
        'Why it matters:\n' +
        impacts
          .map(
            (line) =>
              `${line} For an agency like ${input.businessName}, gaps like these can become client escalations, renewal risk, or fire drills that pull your team away from billable work.`,
          )
          .join('\n\n')
      );
    },
    whatCyberShieldDoes: () =>
      monitoringPitch() +
      ' Agencies use CyberShield to watch client sites continuously — SSL, uptime, header changes, and new risks — without waiting for the next manual audit.',
    whyDifferent: () =>
      'Most agencies only catch website drift when a client reports an issue, a certificate expires, or a launch changes settings without anyone noticing. ' +
      'CyberShield watches continuously across sites so your team sees changes early.',
  },

  saas: {
    whyReachingOut: (input) =>
      `I'm reaching out because CyberShield reviewed ${input.website} as part of our work with software and SaaS companies monitoring their public-facing properties. ` +
      `Our scan identified ${businessFindingSummary(input)}.`,
    whyItMatters: (input) => {
      const impacts = businessImpactLines(input);
      return (
        'Why it matters:\n' +
        impacts
          .map(
            (line) =>
              `${line} For ${input.businessName}, public-site reliability and security posture affect signup conversion, customer trust, and how quickly your team learns about regressions after releases or vendor changes.`,
          )
          .join('\n\n')
      );
    },
    whatCyberShieldDoes: () =>
      monitoringPitch() +
      ' For SaaS teams, that means catching certificate, header, and uptime changes outside your normal deploy cycle — before they show up in support tickets.',
    whyDifferent: () =>
      continuousMonitoringWhy() +
      ' Product teams often discover public-site issues from a prospect, a customer screenshot, or an expired certificate — not from proactive monitoring.',
  },

  technical: {
    whyReachingOut: (input) =>
      `I'm reaching out because CyberShield scanned ${input.website} and identified ${businessFindingSummary(input)}. ` +
      `I'm leading with the business impact first; technical details are included below for your reference.`,
    whyItMatters: (input) => {
      const impacts = businessImpactLines(input, 3);
      return (
        'Why it matters (business impact):\n' +
        impacts
          .map(
            (line) =>
              `${line} Even when the underlying fix is technical, the business outcome is usually downtime risk, trust erosion, or slower incident response.`,
          )
          .join('\n\n')
      );
    },
    whatCyberShieldDoes: () =>
      monitoringPitch() +
      ' You get continuous visibility into SSL, headers, uptime, domain expiration, and configuration drift — with alerts when something changes.',
    whyDifferent: () =>
      'Most teams only revisit public-site security during launches, audits, or incidents. CyberShield monitors continuously so drift and expiration do not depend on someone remembering to check.',
  },
};

function buildColdEmail(variant: OutreachVariant, input: OutreachInput): string {
  const copy = VARIANT_COPY[variant];
  const greeting = `Hi${input.contactName ? ` ${input.contactName}` : ''},`;
  const technicalBlock = variant === 'technical' ? buildTechnicalFindingsBlock(input) : '';

  const body = [
    greeting,
    '',
    copy.whyReachingOut(input),
    '',
    copy.whyItMatters(input),
    '',
    copy.whatCyberShieldDoes(input),
    '',
    copy.whyDifferent(input),
    '',
    lowPressureCta(input),
    technicalBlock,
    '',
    '— CyberShield Cloud',
    'Website monitoring & security intelligence',
  ]
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

  const cta = input.signupUrl
    ? `Would you like the full scan summary? ${input.signupUrl}`
    : "Happy to send the full scan summary if you'd like to see what was flagged.";

  return `Subject: Re: ${input.businessName} — website monitoring

${greeting},

Following up briefly — ${reminder}

${monitoringPitch()}

${cta}

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

I'm reaching out because agencies like ${input.businessName} often manage dozens of client websites — and most only learn about certificate expiration, header drift, or downtime when a client calls.

CyberShield provides continuous website monitoring: SSL, security settings, uptime, domain expiration, and change detection across client sites. You keep the client relationship; we handle the ongoing watch.

We reviewed ${input.website} and found ${businessFindingSummary(input)} as an example of what continuous monitoring catches early.

${lowPressureCta(input)}

— CyberShield Cloud
Website monitoring & security intelligence`;
}

function buildAuditSummary(input: OutreachInput): string {
  const impacts = businessImpactLines(input, 3);
  const variant = selectOutreachVariant(input);
  const technicalBlock =
    variant === 'technical' || (input.issues?.length ?? 0) > 0
      ? `\nTechnical findings:\n${(input.issues ?? ['Review recommended']).map((issue, idx) => `${idx + 1}. ${issue}`).join('\n')}`
      : '';

  return `WEBSITE REVIEW — ${input.businessName}
Website: ${input.website}
${input.scanScore !== undefined ? `Score: ${input.scanScore}/100` : ''}

Business impact summary:
${impacts.map((line) => `• ${line}`).join('\n')}
${technicalBlock}

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
