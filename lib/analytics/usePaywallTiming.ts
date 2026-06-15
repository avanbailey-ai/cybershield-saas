'use client';

import { useEffect, useState } from 'react';
import { getSessionId } from './events';
import { getPaywallDelay } from './paywallTiming';
import { getVariantClient } from './experiments';
import { useConversionScore } from './useConversionScore';

interface PaywallTimingState {
  showPaywall: boolean;
  requireExplicitClick: boolean;
  delayMs: number;
  loading: boolean;
  revealPaywall: () => void;
}

export function usePaywallTiming(): PaywallTimingState {
  const { score, loading: scoreLoading } = useConversionScore();
  const [showPaywall, setShowPaywall] = useState(false);
  const [requireExplicitClick, setRequireExplicitClick] = useState(false);
  const [delayMs, setDelayMs] = useState(2000);
  const [experimentLoaded, setExperimentLoaded] = useState(false);
  const [experimentDelay, setExperimentDelay] = useState<number | undefined>();

  useEffect(() => {
    async function loadExperiment() {
      try {
        const sessionId = getSessionId();
        const res = await fetch('/api/analytics/experiments/paywall_timing');
        if (res.ok) {
          const exp = await res.json();
          const { variant, config } = getVariantClient('paywall_timing', sessionId, exp);
          void fetch('/api/analytics/experiments/impression', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ experiment: 'paywall_timing', variant }),
          });
          if (typeof config.delay_ms === 'number') {
            setExperimentDelay(config.delay_ms);
          }
        }
      } catch {
        // ignore
      } finally {
        setExperimentLoaded(true);
      }
    }
    loadExperiment();
  }, []);

  useEffect(() => {
    if (scoreLoading || !experimentLoaded) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    async function apply() {
      let autopilotDelay: number | undefined;
      try {
        const res = await fetch('/api/analytics/config');
        if (res.ok) {
          const cfg = await res.json();
          autopilotDelay = cfg.paywall_delay_ms;
        }
      } catch {
        // ignore
      }

      if (cancelled) return;

      const timing = getPaywallDelay(score, experimentDelay, autopilotDelay);
      setDelayMs(timing.delayMs);
      setRequireExplicitClick(timing.requireExplicitClick);

      if (timing.requireExplicitClick) {
        setShowPaywall(false);
        return;
      }

      if (timing.delayMs <= 0) {
        setShowPaywall(true);
        return;
      }

      timer = setTimeout(() => {
        if (!cancelled) setShowPaywall(true);
      }, timing.delayMs);
    }

    apply();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [score, scoreLoading, experimentLoaded, experimentDelay]);

  return {
    showPaywall,
    requireExplicitClick,
    delayMs,
    loading: scoreLoading || !experimentLoaded,
    revealPaywall: () => setShowPaywall(true),
  };
}
