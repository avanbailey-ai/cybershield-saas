const SEVEN_DAY_TASKS = [
  'Define ICP and target industries for outreach',
  'Run 10 prospect security scans',
  'Send 5 personalized cold emails',
  'Publish 2 LinkedIn posts',
  'Follow up on warm CRM leads',
  'Review competitor positioning',
  'Analyze conversion funnel drop-offs',
];

const THIRTY_DAY_TASKS = [
  'Week 1: Prospect discovery — 50 scans, 20 outreach messages',
  'Week 2: Content sprint — 6 social posts, 1 video ad script',
  'Week 3: CRM nurture — demo calls, trial activations',
  'Week 4: Retention — churn outreach, upsell campaigns',
  'Set up weekly metrics review ritual',
  'Document winning outreach templates',
  'Launch referral incentive test',
  'Enterprise lead follow-up sequence',
  'Competitor feature gap analysis',
  'Publish case study from best customer',
];

export function defaultCampaignTasks(durationDays: 7 | 30): { title: string; day_offset: number }[] {
  const templates = durationDays === 7 ? SEVEN_DAY_TASKS : THIRTY_DAY_TASKS;
  const daySpread = durationDays === 7 ? 1 : Math.ceil(durationDays / templates.length);

  return templates.map((title, idx) => ({
    title,
    day_offset: durationDays === 7 ? idx : idx * daySpread,
  }));
}
