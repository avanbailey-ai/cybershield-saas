export interface CaseStudy {
  id: string;
  title: string;
  industry: string;
  companySize: string;
  beforeScore: number;
  afterScore: number;
  riskReductionPercent: number;
  timeline: string;
  summary: string;
  highlights: string[];
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    id: 'saas-monitoring',
    title: 'Mid-Market SaaS Platform',
    industry: 'B2B SaaS',
    companySize: '150 employees',
    beforeScore: 38,
    afterScore: 91,
    riskReductionPercent: 62,
    timeline: '90 days',
    summary:
      'A growing SaaS company needed continuous security monitoring across 40+ production domains without adding headcount.',
    highlights: [
      'Automated weekly scans across all environments',
      'SOC2-ready audit log exports',
      'Reduced mean time to remediate by 4x',
    ],
  },
  {
    id: 'fintech-compliance',
    title: 'Regulated Fintech Startup',
    industry: 'Financial Services',
    companySize: '80 employees',
    beforeScore: 45,
    afterScore: 88,
    riskReductionPercent: 48,
    timeline: '60 days',
    summary:
      'A fintech team preparing for SOC2 Type II needed proof of continuous security monitoring and header compliance.',
    highlights: [
      'Multi-tenant org structure with RBAC',
      'Executive summary reports for auditors',
      'SSO-ready architecture alignment',
    ],
  },
  {
    id: 'agency-portfolio',
    title: 'Digital Agency Portfolio',
    industry: 'Agency / MSP',
    companySize: '35 employees',
    beforeScore: 52,
    afterScore: 94,
    riskReductionPercent: 44,
    timeline: '45 days',
    summary:
      'An agency managing 100+ client websites consolidated security monitoring into a single dashboard with client-ready reports.',
    highlights: [
      '100+ websites under one org',
      'White-label executive summaries',
      'Automated client alert digests',
    ],
  },
];
