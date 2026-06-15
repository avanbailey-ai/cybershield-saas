'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import UpgradeModal from './UpgradeModal';
import { trackEvent } from '@/lib/analytics/events';

export type PaywallTrigger =
  | 'full_report'
  | 'second_scan'
  | 'add_website'
  | 'export'
  | 'scan_limit'
  | 'queue_busy'
  | 'manual';

interface UpgradeModalState {
  open: boolean;
  score: number;
  domain?: string;
  trigger: PaywallTrigger;
  recommendedPlan?: 'pro' | 'growth' | 'agency';
}

interface ConversionContextValue {
  openUpgradeModal: (opts: {
    score?: number;
    domain?: string;
    trigger?: PaywallTrigger;
    recommendedPlan?: 'pro' | 'growth' | 'agency';
  }) => void;
  closeUpgradeModal: () => void;
}

const ConversionContext = createContext<ConversionContextValue | null>(null);

const DEFAULT_STATE: UpgradeModalState = {
  open: false,
  score: 50,
  trigger: 'manual',
};

export function ConversionProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<UpgradeModalState>(DEFAULT_STATE);

  const openUpgradeModal = useCallback(
    (opts: {
      score?: number;
      domain?: string;
      trigger?: PaywallTrigger;
      recommendedPlan?: 'pro' | 'growth' | 'agency';
    }) => {
      setModal({
        open: true,
        score: opts.score ?? 50,
        domain: opts.domain,
        trigger: opts.trigger ?? 'manual',
        recommendedPlan: opts.recommendedPlan,
      });
      trackEvent('paywall_viewed', {
        trigger: opts.trigger ?? 'manual',
        score: opts.score,
        domain: opts.domain,
      });
    },
    [],
  );

  const closeUpgradeModal = useCallback(() => {
    setModal((prev) => ({ ...prev, open: false }));
  }, []);

  return (
    <ConversionContext.Provider value={{ openUpgradeModal, closeUpgradeModal }}>
      {children}
      <UpgradeModal
        open={modal.open}
        onClose={closeUpgradeModal}
        score={modal.score}
        domain={modal.domain}
        trigger={modal.trigger}
        recommendedPlan={modal.recommendedPlan}
      />
    </ConversionContext.Provider>
  );
}

export function useConversion(): ConversionContextValue {
  const ctx = useContext(ConversionContext);
  if (!ctx) {
    throw new Error('useConversion must be used within ConversionProvider');
  }
  return ctx;
}

export function useConversionOptional(): ConversionContextValue | null {
  return useContext(ConversionContext);
}
