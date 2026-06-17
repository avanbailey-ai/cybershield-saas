'use client';

import { useEffect, useState } from 'react';

export interface BrainConfigClient {
  cta_placement: 'top' | 'bottom' | 'both';
  show_partial_ai_earlier: boolean;
  cta_text_variant: string;
  paywall_delay_ms: number;
}

const DEFAULTS: BrainConfigClient = {
  cta_placement: 'both',
  show_partial_ai_earlier: false,
  cta_text_variant: 'Protect your site',
  paywall_delay_ms: 2000,
};

export function useBrainConfig() {
  const [config, setConfig] = useState<BrainConfigClient>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/analytics/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (cancelled || !cfg) return;
        setConfig({
          cta_placement: cfg.cta_placement ?? DEFAULTS.cta_placement,
          show_partial_ai_earlier: Boolean(cfg.show_partial_ai_earlier),
          cta_text_variant: cfg.cta_text_variant ?? DEFAULTS.cta_text_variant,
          paywall_delay_ms: Number(cfg.paywall_delay_ms ?? DEFAULTS.paywall_delay_ms),
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { config, loaded };
}
