'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Plan } from '@/lib/billing/plans';
import { PLAN_LIMITS } from '@/lib/billing/plans';

export interface UserInfo {
  id: string;
  email: string;
  plan: Plan;
  subscriptionStatus: string;
  websiteCount: number;
  scansToday: number;
  websitesRemaining: number | null;
  scansRemaining: number;
  effectiveScansLimit: number;
  limits: (typeof PLAN_LIMITS)[Plan];
  loading: boolean;
}

const DEFAULT: UserInfo = {
  id: '',
  email: '',
  plan: 'free',
  subscriptionStatus: 'inactive',
  websiteCount: 0,
  scansToday: 0,
  websitesRemaining: 0,
  scansRemaining: 0,
  effectiveScansLimit: PLAN_LIMITS.free.maxScansPerDay,
  limits: PLAN_LIMITS.free,
  loading: true,
};

let cached: UserInfo | null = null;
let inflight: Promise<UserInfo | null> | null = null;

async function fetchUserInfo(): Promise<UserInfo | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const res = await fetch('/api/user/plan');
  if (!res.ok) {
    return {
      ...DEFAULT,
      id: user.id,
      email: user.email ?? '',
      loading: false,
    };
  }

  const data = await res.json();
  const plan = (data.plan as Plan) ?? 'free';
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

  const effectiveLimit = data.effectiveScansLimit ?? limits.maxScansPerDay;
  const scansRemaining =
    data.scansRemaining ??
    (effectiveLimit === Infinity
      ? Infinity
      : Math.max(0, effectiveLimit - (data.scansToday ?? 0)));

  return {
    id: user.id,
    email: user.email ?? '',
    plan,
    subscriptionStatus: data.subscription_status ?? 'inactive',
    websiteCount: data.websiteCount ?? 0,
    scansToday: data.scansToday ?? 0,
    websitesRemaining: data.websitesRemaining ?? null,
    scansRemaining,
    effectiveScansLimit: effectiveLimit,
    limits,
    loading: false,
  };
}

function loadUserInfo(): Promise<UserInfo | null> {
  if (cached && !cached.loading) return Promise.resolve(cached);
  if (inflight) return inflight;

  inflight = fetchUserInfo()
    .then((info) => {
      if (info) cached = info;
      return info;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Single source of truth for client-side user + plan data. */
export function useUser(): UserInfo & { refresh: () => Promise<void> } {
  const [info, setInfo] = useState<UserInfo>(cached ?? DEFAULT);

  const refresh = useCallback(async () => {
    cached = null;
    setInfo((prev) => ({ ...prev, loading: true }));
    const next = await fetchUserInfo();
    if (next) {
      cached = next;
      setInfo(next);
    } else {
      setInfo({ ...DEFAULT, loading: false });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadUserInfo().then((next) => {
      if (cancelled) return;
      if (next) setInfo(next);
      else setInfo({ ...DEFAULT, loading: false });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { ...info, refresh };
}

export function invalidateUserCache(): void {
  cached = null;
}
