export interface FeaturePageDef {
  slug: string;
  title: string;
  headline: string;
  description: string;
  keywords: string[];
  intro: string;
  benefits: string[];
  relatedSlugs: string[];
}

export const FEATURE_PAGES: FeaturePageDef[] = [
  {
    slug: 'website-security-monitoring',
    title: 'Website Security Monitoring',
    headline: 'Continuous website security monitoring',
    description:
      'Monitor website security posture continuously with scores, alerts, and change detection — built for small businesses and agencies.',
    keywords: ['website security monitoring', 'website monitoring software', 'security monitoring'],
    intro:
      'CyberShield Cloud monitors your websites on a schedule that matches your paid plan so you know when security posture shifts — not weeks later during a manual review.',
    benefits: [
      'Automated security scans on a schedule that matches your plan',
      'Security score tracking with historical context',
      'Email alerts when risk increases or critical issues appear',
      'Health Center dashboard for every monitored site',
    ],
    relatedSlugs: ['ssl-monitoring', 'website-change-detection', 'security-reports'],
  },
  {
    slug: 'ssl-monitoring',
    title: 'SSL Monitoring',
    headline: 'SSL certificate monitoring and expiry alerts',
    description:
      'Track TLS certificates, expiry dates, and HTTPS configuration. Get alerted before browsers show security warnings.',
    keywords: ['SSL monitoring', 'certificate expiry alerts', 'HTTPS monitoring'],
    intro:
      'Expired or misconfigured SSL erodes visitor trust and can block conversions. CyberShield monitors certificates and HTTPS behavior continuously.',
    benefits: [
      'Certificate expiry alerts before browser warnings appear',
      'HTTPS and TLS configuration checks',
      'Change detection when certificates or redirects shift',
      'Clear remediation guidance in your dashboard',
    ],
    relatedSlugs: ['domain-monitoring', 'website-security-monitoring', 'website-health-monitoring'],
  },
  {
    slug: 'website-change-detection',
    title: 'Website Change Detection',
    headline: 'Detect website configuration changes',
    description:
      'Website change detection for scripts, headers, SSL events, and security score shifts — with a timeline your team can audit.',
    keywords: ['website change detection', 'website monitoring', 'security change alerts'],
    intro:
      'Websites change constantly — some changes are benign, others are not. CyberShield records what changed, when, and why it matters.',
    benefits: [
      'Change timeline per website',
      'Alerts for new scripts and removed security headers',
      'Score drop detection with context',
      'Audit-friendly change history for agencies and internal review',
    ],
    relatedSlugs: ['website-security-monitoring', 'website-intelligence', 'security-reports'],
  },
  {
    slug: 'domain-monitoring',
    title: 'Domain Monitoring',
    headline: 'Domain health and registration monitoring',
    description:
      'Monitor domain configuration alongside SSL and uptime so registration or DNS issues do not take your business offline.',
    keywords: ['domain monitoring', 'website uptime', 'DNS monitoring'],
    intro:
      'Domain lapses and DNS misconfigurations can remove your site from the internet entirely. CyberShield tracks domain-related signals with your security program.',
    benefits: [
      'Monitor domain registration signals alongside SSL and HTTP status from scheduled scans',
      'Early warning when configuration drifts',
      'Unified view in the Health Center',
      'Works with multi-site agency portfolios',
    ],
    relatedSlugs: ['ssl-monitoring', 'website-health-monitoring', 'agency-monitoring'],
  },
  {
    slug: 'website-health-monitoring',
    title: 'Website Health Monitoring',
    headline: 'Website health scores and monitoring',
    description:
      'Website health monitoring with security scores, SSL status, uptime signals, and actionable fix guidance in one dashboard.',
    keywords: ['website health monitoring', 'website health score', 'website risk assessment'],
    intro:
      'Health monitoring summarizes security score, SSL status, and recent scan HTTP status — not dedicated uptime probes on every plan.',
    benefits: [
      '0–100 security health score per site',
      'SSL, headers, and recent scan status in one view',
      'Trend visibility over time',
      'Prioritized issues with plain-language explanations',
    ],
    relatedSlugs: ['website-security-monitoring', 'security-reports', 'ssl-monitoring'],
  },
  {
    slug: 'security-reports',
    title: 'Security Reports',
    headline: 'Website security reports and risk assessment',
    description:
      'Generate website security reports and risk assessments from real scan data — shareable with clients, leadership, and stakeholders.',
    keywords: ['website security reports', 'website risk assessment', 'security audit report'],
    intro:
      'Stakeholders need clarity, not raw scanner output. CyberShield turns findings into reports teams can act on.',
    benefits: [
      'Report views from completed scans',
      'Risk level and score summaries',
      'Issue lists with severity context',
      'Agency-friendly outputs for client conversations',
    ],
    relatedSlugs: ['website-health-monitoring', 'agency-monitoring', 'website-intelligence'],
  },
  {
    slug: 'agency-monitoring',
    title: 'Agency Monitoring',
    headline: 'Website security monitoring for agencies',
    description:
      'Monitor many client websites with priority slots, faster check intervals, and portfolio-level visibility for digital agencies.',
    keywords: ['agency website monitoring', 'client security monitoring', 'MSP security'],
    intro:
      'Agencies need monitoring that scales across client sites without becoming another tab-spreadsheet problem.',
    benefits: [
      'Monitor up to 250 websites on Agency plans',
      '5-minute priority monitoring for critical client sites',
      'Per-client Health Center and change history',
      'Client-ready report copy exports (manual — CyberShield does not email clients automatically)',
    ],
    relatedSlugs: ['website-security-monitoring', 'security-reports', 'website-intelligence'],
  },
  {
    slug: 'website-intelligence',
    title: 'Website Intelligence',
    headline: 'Website intelligence from continuous monitoring',
    description:
      'Website intelligence built from continuous scans — trends, changes, and risk signals instead of one-off snapshots.',
    keywords: ['website intelligence', 'security trends', 'website analytics security'],
    intro:
      'Intelligence means comparing today to yesterday, last week, and last month — not guessing from a single scan.',
    benefits: [
      'Historical score and change context',
      'Organization-level risk rollups for teams',
      'Signals that inform prioritization',
      'Foundation for proactive security operations',
    ],
    relatedSlugs: ['website-change-detection', 'security-reports', 'website-security-monitoring'],
  },
];

export function getFeatureBySlug(slug: string): FeaturePageDef | undefined {
  return FEATURE_PAGES.find((f) => f.slug === slug);
}
