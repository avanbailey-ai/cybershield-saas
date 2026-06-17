'use client';

import { useEffect, useState } from 'react';
import type { BilledPlan } from './plans';
import { MARKETING_FALLBACK_PRICES } from './marketingPrices';

type DisplayPrices = Partial<Record<BilledPlan, number>>;

export function useDisplayPrices() {
  const [prices, setPrices] = useState<DisplayPrices>({ ...MARKETING_FALLBACK_PRICES });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/billing/prices');
        if (!res.ok) return;
        const data = (await res.json()) as { prices?: DisplayPrices };
        if (!cancelled && data.prices) {
          setPrices({ ...MARKETING_FALLBACK_PRICES, ...data.prices });
        }
      } catch {
        // Non-fatal — UI shows placeholder
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { prices, loading };
}
