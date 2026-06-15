'use client';

import { type ReactNode } from 'react';
import { useConversionScore } from '@/lib/analytics/useConversionScore';
import { getAdaptationConfig, getCtaLabel, getIntentTier } from '@/lib/analytics/uiAdaptation';
import { getSessionId } from '@/lib/analytics/events';
import { getVariantClient } from '@/lib/analytics/experimentsClient';
import { useEffect, useState } from 'react';

interface ExperimentData {
  traffic_split: number;
  winner: 'a' | 'b' | null;
  active: boolean;
  variant_a: Record<string, unknown>;
  variant_b: Record<string, unknown>;
}

interface AdaptiveCTAProps {
  children?: ReactNode;
  domain?: string;
  onClick?: () => void;
  className?: string;
  fallbackLabel?: string;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export default function AdaptiveCTA({
  children,
  domain,
  onClick,
  className = '',
  fallbackLabel = 'Upgrade Now',
  variant = 'primary',
  disabled = false,
}: AdaptiveCTAProps) {
  const { score, loading } = useConversionScore();
  const [ctaText, setCtaText] = useState<string | null>(null);

  useEffect(() => {
    async function loadExperiment() {
      try {
        const sessionId = getSessionId();
        const res = await fetch('/api/analytics/experiments/cta_text');
        if (!res.ok) return;
        const exp = (await res.json()) as ExperimentData;
        const { variant: v, config } = getVariantClient('cta_text', sessionId, {
          ...exp,
          name: 'cta_text',
        } as ExperimentData & { name: string });
        void fetch('/api/analytics/experiments/impression', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ experiment: 'cta_text', variant: v }),
        });
        if (config.text) setCtaText(String(config.text));
      } catch {
        // ignore
      }
    }
    loadExperiment();
  }, []);

  const tier = getIntentTier(score);
  const config = getAdaptationConfig(tier);
  const label =
    (typeof children === 'string' ? children : null) ??
    getCtaLabel(config.ctaStyle, domain, ctaText ?? undefined) ??
    fallbackLabel;

  const baseClass =
    variant === 'primary'
      ? 'rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500'
      : 'rounded-lg border border-gray-700 px-4 py-3 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white';

  const urgencyClass =
    config.showUrgency && tier === 'high'
      ? ' ring-2 ring-red-500/40 animate-pulse'
      : '';

  if (loading && !children) {
    return (
      <button type="button" disabled className={`${baseClass} opacity-60 ${className}`}>
        Loading…
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${baseClass}${urgencyClass} disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {label}
    </button>
  );
}

export function useAdaptiveConfig() {
  const { score } = useConversionScore();
  const tier = getIntentTier(score);
  return { score, tier, config: getAdaptationConfig(tier) };
}
