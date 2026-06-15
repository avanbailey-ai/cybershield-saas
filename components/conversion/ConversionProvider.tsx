'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import UpgradeModal from './UpgradeModal';
import { trackEvent } from '@/lib/analytics/events';
import { markUpgradeModalShown, wasUpgradeModalShownThisSession } from '@/lib/conversion/limits';

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
    force?: boolean;
  }) => void;
  closeUpgradeModal: () => void;
  isUpgradeModalOpen: boolean;
}

const ConversionContext = createContext<ConversionContextValue | null>(null);

const DEFAULT_STATE: UpgradeModalState = {
  open: false,
  score: 50,
  trigger: 'manual',
};

export function ConversionProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<UpgradeModalState>(DEFAULT_STATE);
  const openRef = useRef(false);

  const openUpgradeModal = useCallback(
    (opts: {
      score?: number;
      domain?: string;
      trigger?: PaywallTrigger;
      recommendedPlan?: 'pro' | 'growth' | 'agency';
      force?: boolean;
    }) => {
      const trigger = opts.trigger ?? 'manual';
      const isLimitTrigger = trigger === 'scan_limit' || trigger === 'second_scan';

      if (!opts.force && isLimitTrigger && wasUpgradeModalShownThisSession()) {
        return;
      }

      if (openRef.current && !opts.force) {
        return;
      }

      openRef.current = true;
      if (isLimitTrigger) {
        markUpgradeModalShown();
      }

      setModal({
        open: true,
        score: opts.score ?? 50,
        domain: opts.domain,
        trigger,
        recommendedPlan: opts.recommendedPlan,
      });
      trackEvent('paywall_viewed', {
        trigger,
        score: opts.score,
        domain: opts.domain,
      });
    },
    [],
  );

  const closeUpgradeModal = useCallback(() => {
    openRef.current = false;
    setModal((prev) => ({ ...prev, open: false }));
  }, []);

  return (
    <ConversionContext.Provider
      value={{ openUpgradeModal, closeUpgradeModal, isUpgradeModalOpen: modal.open }}
    >
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
