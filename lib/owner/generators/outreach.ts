export interface OutreachInput {
  businessName: string;
  website: string;
  industry?: string;
  city?: string;
  scanScore?: number;
  riskLevel?: string;
  issues?: string[];
  contactName?: string;
  signupUrl?: string;
}

export type OutreachType =
  | 'cold_email'
  | 'linkedin'
  | 'facebook'
  | 'follow_up'
  | 'agency_pitch'
  | 'audit_summary';

function findingLine(input: OutreachInput): string {
  if (input.issues?.length) {
    const top = input.issues.slice(0, 2).join(' and ');
    return `Our scan of ${input.website} flagged ${top}.`;
  }
  if (input.scanScore !== undefined && input.scanScore < 70) {
    return `Our scan of ${input.website} scored ${input.scanScore}/100 — there are fixes worth addressing before they become incidents.`;
  }
  return `We reviewed ${input.website} and found configuration gaps that are common before a security incident.`;
}

const TEMPLATES: Record<OutreachType, (input: OutreachInput) => string> = {
  cold_email: (i) => {
    const finding = findingLine(i);
    const cta = i.signupUrl
      ? `See your score and start monitoring: ${i.signupUrl}`
      : 'Reply if you want the full scan summary — happy to walk through it in 10 minutes.';
    return `Subject: ${i.businessName} — security scan findings

Hi${i.contactName ? ` ${i.contactName}` : ''},

I'm reaching out because ${finding}

CyberShield Cloud monitors SSL, headers, and site changes continuously for ${i.industry ?? 'businesses'} like ${i.businessName} — not just one-time scans.

${cta}

— CyberShield Cloud
Website security monitoring`;
  },

  follow_up: (i) => {
    const finding =
      i.scanScore !== undefined
        ? `Your site scored ${i.scanScore}/100 on our last check.`
        : `Our earlier note about ${i.website} is still relevant.`;
    const cta = i.signupUrl
      ? `Start a free scan: ${i.signupUrl}`
      : 'Still open to a quick walkthrough if useful.';
    return `Subject: Re: security monitoring for ${i.businessName}

Hi${i.contactName ? ` ${i.contactName}` : ''},

Following up briefly — ${finding}

${cta}

— CyberShield Cloud`;
  },

  linkedin: (i) => `Hi — I help ${i.industry ?? 'local businesses'} keep websites monitored between audits.

${findingLine(i)}

Happy to share the scan summary for ${i.businessName} if useful.`,

  facebook: (i) => `${i.businessName} team — quick note on ${i.website}.

${findingLine(i)}

DM if you'd like the free scan summary.`,

  agency_pitch: (i) => `Partnership — white-label security monitoring for ${i.businessName}

We handle continuous scans, alerts, and client reports. You keep the relationship.
Site: ${i.website}`,

  audit_summary: (i) => `SECURITY SUMMARY — ${i.businessName}
Website: ${i.website}
${i.scanScore !== undefined ? `Score: ${i.scanScore}/100` : ''}

Findings:
${(i.issues ?? ['Review recommended']).map((issue, idx) => `${idx + 1}. ${issue}`).join('\n')}

CyberShield Cloud — continuous monitoring`,
};

export function generateOutreach(type: OutreachType, input: OutreachInput): string {
  return TEMPLATES[type](input);
}

export const OUTREACH_TYPES: { id: OutreachType; label: string }[] = [
  { id: 'cold_email', label: 'Cold Email' },
  { id: 'linkedin', label: 'LinkedIn Message' },
  { id: 'facebook', label: 'Facebook DM' },
  { id: 'follow_up', label: 'Follow-up' },
  { id: 'agency_pitch', label: 'Agency Pitch' },
  { id: 'audit_summary', label: 'Audit Summary' },
];
