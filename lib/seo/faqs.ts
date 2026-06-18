export const LANDING_FAQS = [
  {
    question: 'How is this different from a one-time security scan?',
    answer:
      'A one-time scan shows your posture today. CyberShield monitors continuously — tracking SSL expiry, uptime, header changes, and score trends over time. You get alerts when something changes, not just a snapshot.',
  },
  {
    question: 'How does monitoring work?',
    answer:
      'Pro includes daily automated monitoring checks plus weekly deep scans. Growth adds hourly monitoring checks and change detection. Agency includes 5-minute monitoring for priority websites and hourly monitoring for remaining sites.',
  },
  {
    question: 'What happens when my SSL certificate expires?',
    answer:
      'Browsers show security warnings that erode visitor trust and can reduce conversions. CyberShield alerts you well before expiry so you can renew.',
  },
  {
    question: 'How often are websites checked?',
    answer:
      'Pro runs daily monitoring checks with weekly deep scans. Growth runs hourly monitoring checks. Agency runs 5-minute monitoring for priority websites.',
  },
  {
    question: 'Can I monitor multiple websites?',
    answer:
      'Yes. Pro includes 10 websites, Growth includes 50, and Agency includes 250 websites.',
  },
  {
    question: 'Is there a free option?',
    answer:
      'Yes. Use the free public scan at /scan — no account required. Continuous monitoring requires a paid plan after signup.',
  },
] as const;
