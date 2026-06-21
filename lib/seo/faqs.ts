export const LANDING_FAQS = [
  {
    question: 'What does CyberShield check?',
    answer:
      'CyberShield monitors common website security signals including SSL/TLS certificate status, security headers, domain registration signals, uptime, and changes to page structure over time. Findings are presented in plain English with remediation guidance.',
  },
  {
    question: 'Does CyberShield fix issues automatically?',
    answer:
      'No. CyberShield identifies risks and provides guidance, but you or your developer must implement fixes on your website, hosting, or DNS provider.',
  },
  {
    question: 'Does CyberShield guarantee my site cannot be hacked?',
    answer:
      'No. CyberShield helps detect common issues and changes; it does not guarantee complete security or prevent all attacks. See our Security Disclaimer for full limitations.',
  },
  {
    question: 'Can I scan websites I do not own?',
    answer:
      'No. You may only scan websites you own, manage, or are explicitly authorized to test. Unauthorized scanning violates our Acceptable Use Policy.',
  },
  {
    question: 'Is CyberShield for agencies?',
    answer:
      'Yes. The Agency plan supports multi-client monitoring, client-ready reports, portfolio views, and higher website limits. Partner inquiries: partners@cybershieldcloud.com.',
  },
  {
    question: 'What happens after I subscribe?',
    answer:
      'After checkout, add your websites to the dashboard. CyberShield begins scheduled monitoring based on your plan, sends alerts when configured, and stores scan history and reports in your account.',
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      'Yes. Cancel from billing settings or the Stripe customer portal. Cancellation stops future charges; access continues through the end of the paid period.',
  },
  {
    question: 'How do alerts work?',
    answer:
      'CyberShield sends email alerts for important changes such as SSL expiry warnings, downtime, score drops, and significant configuration changes. Alert frequency depends on your plan and notification settings.',
  },
  {
    question: 'Do I need to be technical to understand the reports?',
    answer:
      'No. Reports use plain-English summaries, risk scores, and step-by-step remediation guidance. Technical details are available when you need them for developers.',
  },
  {
    question: 'How is this different from a one-time security scan?',
    answer:
      'A one-time scan shows today’s posture. Paid plans add continuous monitoring, change detection, alerts, and history so you know when something changes — not just a single snapshot.',
  },
  {
    question: 'Is there a free option?',
    answer:
      'Yes. Use the free public scan at /scan with no account required. Ongoing monitoring, full reports, and alerts require a paid plan.',
  },
] as const;
