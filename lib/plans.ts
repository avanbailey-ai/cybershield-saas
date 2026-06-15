import { PLAN_LIMITS, type Plan } from '@/lib/billing/plans';

export type PlanId = Plan;

export interface PlanInfo {
  id: PlanId;
  name: string;
  price: number | null;
  websiteLimit: number;
  scanFrequency: string;
  maxScansPerDay: number;
  features: string[];
}

export const PLANS: Record<PlanId, PlanInfo> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    websiteLimit: PLAN_LIMITS.free.websites,
    scanFrequency: PLAN_LIMITS.free.scanFrequency,
    maxScansPerDay: PLAN_LIMITS.free.maxScansPerDay,
    features: ['1 website', 'Manual scans', 'Basic risk score', 'Email alerts'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 49,
    websiteLimit: PLAN_LIMITS.pro.websites,
    scanFrequency: PLAN_LIMITS.pro.scanFrequency,
    maxScansPerDay: PLAN_LIMITS.pro.maxScansPerDay,
    features: ['5 websites', 'Weekly scans', 'Email alerts', 'Security scoring'],
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    price: 99,
    websiteLimit: PLAN_LIMITS.growth.websites,
    scanFrequency: PLAN_LIMITS.growth.scanFrequency,
    maxScansPerDay: PLAN_LIMITS.growth.maxScansPerDay,
    features: ['25 websites', 'Daily scans', 'Security scoring', 'Priority queue'],
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    price: 199,
    websiteLimit: PLAN_LIMITS.agency.websites,
    scanFrequency: PLAN_LIMITS.agency.scanFrequency,
    maxScansPerDay: PLAN_LIMITS.agency.maxScansPerDay,
    features: ['100 websites', 'Hourly monitoring', 'Team access', 'Priority support'],
  },
};

export function getPlanById(id: string): PlanInfo {
  if (id === 'business' || id === 'starter') return PLANS.pro;
  return PLANS[id as PlanId] ?? PLANS.free;
}

export function getWebsiteLimit(plan: PlanId): number {
  return PLANS[plan].websiteLimit;
}

export function canAddWebsite(currentCount: number, plan: PlanId): boolean {
  return currentCount < PLANS[plan].websiteLimit;
}

export type { Plan };
