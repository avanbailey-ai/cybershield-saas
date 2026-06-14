export type PlanId = 'free' | 'starter' | 'pro' | 'agency';

export interface Plan {
  id: PlanId;
  name: string;
  price: number | null; // null = contact sales
  websiteLimit: number | null; // null = unlimited
  scanFrequency: string;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    websiteLimit: 1,
    scanFrequency: 'Manual only',
    features: ['1 website', 'Manual scans', 'Basic risk score', 'Email alerts'],
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 19,
    websiteLimit: 5,
    scanFrequency: 'Daily',
    features: ['5 websites', 'Daily automated scans', 'Full breakdown', 'Email alerts', 'Scan history'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 79,
    websiteLimit: 25,
    scanFrequency: 'Every 6 hours',
    features: ['25 websites', '6-hour scans', 'Priority support', 'API access', 'Team reports'],
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    price: 249,
    websiteLimit: null,
    scanFrequency: 'Hourly',
    features: ['Unlimited websites', 'Hourly scans', 'White-label reports', 'Dedicated support', 'Custom integrations'],
  },
};

export function getPlanById(id: string): Plan {
  if (id === 'business') return PLANS.pro; // backward compat alias
  return PLANS[id as PlanId] ?? PLANS.free;
}

export function getWebsiteLimit(plan: PlanId): number | null {
  return PLANS[plan].websiteLimit;
}

export function canAddWebsite(currentCount: number, plan: PlanId): boolean {
  const limit = PLANS[plan].websiteLimit;
  if (limit === null) return true; // unlimited
  return currentCount < limit;
}
