'use client';

import { useEffect, useState } from 'react';
import { PLAN_LIMITS, type Plan } from './plans';

export interface PlanInfo {
  plan: Plan;
  limits: (typeof PLAN_LIMITS)[Plan];
  websiteCount: number;
  scansToday: number;
  websitesRemaining: number;
  scansRemaining: number;
  loading: boolean;
}

const DEFAULT_LIMITS = PLAN_LIMITS.pro;

export function usePlan(): PlanInfo {
  const [info, setInfo] = useState<PlanInfo>({
    plan: 'pro',
    limits: DEFAULT_LIMITS,
    websiteCount: 0,
    scansToday: 0,
    websitesRemaining: DEFAULT_LIMITS.websites,
    scansRemaining: DEFAULT_LIMITS.maxScansPerDay,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchPlan() {
      try {
        const res = await fetch('/api/user/plan');
        if (!res.ok) return;

        const data = await res.json();
        if (cancelled) return;

        const plan = (data.plan as Plan) ?? 'pro';
        const limits = PLAN_LIMITS[plan] ?? DEFAULT_LIMITS;

        setInfo({
          plan,
          limits,
          websiteCount: data.websiteCount ?? 0,
          scansToday: data.scansToday ?? 0,
          websitesRemaining: data.websitesRemaining ?? Math.max(0, limits.websites - (data.websiteCount ?? 0)),
          scansRemaining: data.scansRemaining ?? Math.max(0, limits.maxScansPerDay - (data.scansToday ?? 0)),
          loading: false,
        });
      } catch {
        if (!cancelled) {
          setInfo((prev) => ({ ...prev, loading: false }));
        }
      }
    }

    fetchPlan();
    return () => {
      cancelled = true;
    };
  }, []);

  return info;
}
