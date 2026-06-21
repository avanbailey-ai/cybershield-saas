export interface CaseStudy {
  id: string;
  title: string;
  industry: string;
  companySize: string;
  summary: string;
  highlights: string[];
  /** Illustrative scenario — not a verified customer outcome */
  illustrative: true;
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    id: 'saas-monitoring',
    title: 'Mid-Market SaaS Platform (illustrative)',
    industry: 'B2B SaaS',
    companySize: '150 employees',
    illustrative: true,
    summary:
      'Example: a growing SaaS team wants continuous header and SSL monitoring across many production domains without adding headcount.',
    highlights: [
      'Scheduled scans across monitored environments',
      'Scan history for change review',
      'Plain-English remediation guidance for developers',
    ],
  },
  {
    id: 'fintech-compliance',
    title: 'Regulated Fintech Startup (illustrative)',
    industry: 'Financial Services',
    companySize: '80 employees',
    illustrative: true,
    summary:
      'Example: a fintech team wants ongoing visibility into TLS and security header posture while planning a formal compliance program.',
    highlights: [
      'Multi-tenant org structure with role-based access',
      'Reports from real scan data for internal review',
      'Custom enterprise options available by sales inquiry',
    ],
  },
  {
    id: 'agency-portfolio',
    title: 'Digital Agency Portfolio (illustrative)',
    industry: 'Agency / MSP',
    companySize: '35 employees',
    illustrative: true,
    summary:
      'Example: an agency managing many client websites consolidates monitoring into one dashboard with client-ready copy exports.',
    highlights: [
      'Up to 250 websites on Agency plan',
      'Client-ready report copy (manual export — no auto client emails)',
      'Weekly digest emails for the organization',
    ],
  },
];

export const CASE_STUDIES_DISCLAIMER =
  'Illustrative scenarios for planning conversations. These are not verified customer outcomes or guaranteed results.';
