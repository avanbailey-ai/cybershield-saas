'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Plan } from '@/lib/billing/plans';
import { PLAN_LIMITS } from '@/lib/billing/plans';

export interface UserInfo {
  id: string;
  email: string;
  plan: Plan;
  subscriptionStatus: string;
  orgId: string | null;
  orgRole: string | null;
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
  orgId: null,
  orgRole: null,
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

type UserInfoSubscriber = (info: UserInfo) => void;
const subscribers = new Set<UserInfoSubscriber>();

function publish(info: UserInfo): void {
  cached = info;
  subscribers.forEach((subscriber) => subscriber(info));
}

function subscribe(subscriber: UserInfoSubscriber): () => void {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

const CHECKOUT_REFRESH_ATTEMPTS = 5;
const CHECKOUT_REFRESH_INTERVAL_MS = 2000;

function isCheckoutReturn(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('checkout') === 'processing' || params.get('checkout') === 'success';
}

async function fetchUserInfo(): Promise<UserInfo | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const res = await fetch('/api/user/plan', { cache: 'no-store' });
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
  // Plan is resolved server-side from organization_subscriptions only (/api/user/plan).

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
    orgId: data.orgId ?? null,
    orgRole: data.orgRole ?? null,
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
      if (info) publish(info);
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
  const checkoutRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    publish({ ...(cached ?? DEFAULT), loading: true });
    cached = null;
    const next = await fetchUserInfo();
    if (next) {
      publish(next);
    } else {
      publish({ ...DEFAULT, loading: false });
    }
  }, []);

  useEffect(() => subscribe(setInfo), []);

  useEffect(() => {
    let cancelled = false;

    loadUserInfo().then((next) => {
      if (cancelled) return;
      if (next) publish(next);
      else publish({ ...DEFAULT, loading: false });
    });

    function onVisible() {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    }

    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        void refresh();
      }
    }

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [refresh]);

  useEffect(() => {
    if (!isCheckoutReturn()) return;

    let attempts = 0;
    void refresh();

    checkoutRefreshRef.current = setInterval(() => {
      attempts += 1;
      void refresh();
      if (attempts >= CHECKOUT_REFRESH_ATTEMPTS && checkoutRefreshRef.current) {
        clearInterval(checkoutRefreshRef.current);
        checkoutRefreshRef.current = null;
      }
    }, CHECKOUT_REFRESH_INTERVAL_MS);

    return () => {
      if (checkoutRefreshRef.current) {
        clearInterval(checkoutRefreshRef.current);
        checkoutRefreshRef.current = null;
      }
    };
  }, [refresh]);

  return { ...info, refresh };
}

export function invalidateUserCache(): void {
  cached = null;
}
