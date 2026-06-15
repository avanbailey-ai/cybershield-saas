'use client';

import { useState } from 'react';
import ShareResultModal from '@/components/conversion/ShareResultModal';

/**
 * CyberShield security score: higher = better (0–100).
 * User-facing "high risk" triggers when score < 40 (not risk_score > 70).
 */
export const HIGH_RISK_SECURITY_SCORE_THRESHOLD = 40;

const SHARE_MODAL_SHOWN_KEY = 'cs_referral_shown';

interface ScanResultViralTriggersProps {
  domain: string;
  score: number;
  shareToken?: string | null;
  reportViewed?: boolean;
}

export function useScanResultViralTriggers({
  domain,
  score,
  shareToken,
}: ScanResultViralTriggersProps) {
  const [shareOpen, setShareOpen] = useState(false);

  function markShareModalShown() {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SHARE_MODAL_SHOWN_KEY, '1');
    }
  }

  function wasShareModalShown(): boolean {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(SHARE_MODAL_SHOWN_KEY) === '1';
  }

  // Auto share prompts disabled — user must explicitly choose to share.
  // Prevents modal interruptions during scan review flows.

  const closeShare = () => {
    setShareOpen(false);
  };

  return {
    shareModal: (
      <ShareResultModal
        domain={domain}
        score={score}
        shareToken={shareToken}
        isOpen={shareOpen}
        onClose={closeShare}
      />
    ),
    openShare: () => {
      if (!wasShareModalShown()) {
        markShareModalShown();
      }
      setShareOpen(true);
    },
  };
}
