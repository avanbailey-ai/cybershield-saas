'use client';

import { useEffect, useState } from 'react';
import ShareResultModal from '@/components/conversion/ShareResultModal';

/**
 * CyberShield security score: higher = better (0–100).
 * User-facing "high risk" triggers when score < 40 (not risk_score > 70).
 */
export const HIGH_RISK_SECURITY_SCORE_THRESHOLD = 40;

const SHARE_MODAL_SHOWN_KEY = 'cybershield_share_modal_shown';

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
  reportViewed = true,
}: ScanResultViralTriggersProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [exitShareOpen, setExitShareOpen] = useState(false);
  const [highRiskPrompted, setHighRiskPrompted] = useState(false);
  const [timedPrompted, setTimedPrompted] = useState(false);

  function markShareModalShown() {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SHARE_MODAL_SHOWN_KEY, '1');
    }
  }

  function wasShareModalShown(): boolean {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(SHARE_MODAL_SHOWN_KEY) === '1';
  }

  useEffect(() => {
    if (!reportViewed || highRiskPrompted || wasShareModalShown()) return;
    if (score < HIGH_RISK_SECURITY_SCORE_THRESHOLD) {
      const timer = setTimeout(() => {
        markShareModalShown();
        setShareOpen(true);
        setHighRiskPrompted(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [score, reportViewed, highRiskPrompted]);

  useEffect(() => {
    if (!reportViewed || timedPrompted || wasShareModalShown()) return;
    const timer = setTimeout(() => {
      markShareModalShown();
      setShareOpen(true);
      setTimedPrompted(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [reportViewed, timedPrompted]);

  useEffect(() => {
    if (!reportViewed || typeof window === 'undefined') return;

    const key = 'cybershield_scan_exit_share_shown';
    if (sessionStorage.getItem(key)) return;

    function handleMouseLeave(e: MouseEvent) {
      if (e.clientY > 0) return;
      if (sessionStorage.getItem(key) || wasShareModalShown()) return;
      sessionStorage.setItem(key, '1');
      markShareModalShown();
      setExitShareOpen(true);
    }

    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, [reportViewed]);

  const activeShareOpen = shareOpen || exitShareOpen;
  const closeShare = () => {
    setShareOpen(false);
    setExitShareOpen(false);
  };

  return {
    shareModal: (
      <ShareResultModal
        domain={domain}
        score={score}
        shareToken={shareToken}
        isOpen={activeShareOpen}
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
