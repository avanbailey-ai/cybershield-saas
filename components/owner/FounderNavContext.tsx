'use client';

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  FOUNDER_SECTIONS,
  type FounderSectionId,
  resolveFounderSection,
} from '@/lib/owner/founderNav';
import type { FounderOsV6Data } from '@/lib/owner/founderOsV6';

export interface FounderReviewTarget {
  prospectId?: string;
  draftId?: string;
  focus?: 'send-queue' | 'prospect';
}

interface FounderNavContextValue {
  section: FounderSectionId;
  setSection: (id: FounderSectionId) => void;
  email: string;
  founderData: FounderOsV6Data;
  refreshFounderData: () => Promise<void>;
  setFounderData: (data: FounderOsV6Data) => void;
  reviewTarget: FounderReviewTarget | null;
  openProspectsReview: (target: FounderReviewTarget) => void;
  clearReviewTarget: () => void;
}

const FounderNavContext = createContext<FounderNavContextValue | null>(null);

export function FounderNavProvider({
  email,
  initialFounderData,
  children,
}: {
  email: string;
  initialFounderData: FounderOsV6Data;
  children: ReactNode;
}) {
  const [section, setSectionState] = useState<FounderSectionId>('home');
  const [founderData, setFounderData] = useState(initialFounderData);
  const [reviewTarget, setReviewTarget] = useState<FounderReviewTarget | null>(null);

  const setSection = useCallback((id: FounderSectionId) => {
    setSectionState(id);
    window.history.replaceState(null, '', `#${id}`);
  }, []);

  const openProspectsReview = useCallback((target: FounderReviewTarget) => {
    setReviewTarget(target);
    setSectionState('prospects');
    window.history.replaceState(null, '', '#prospects');
  }, []);

  const clearReviewTarget = useCallback(() => setReviewTarget(null), []);

  const refreshFounderData = useCallback(async () => {
    const res = await fetch('/api/owner/founder-os');
    const json = await res.json();
    if (json.data) setFounderData(json.data);
  }, []);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const resolved = resolveFounderSection(hash);
    if (resolved) setSectionState(resolved);
  }, []);

  return (
    <FounderNavContext.Provider
      value={{
        section,
        setSection,
        email,
        founderData,
        refreshFounderData,
        setFounderData,
        reviewTarget,
        openProspectsReview,
        clearReviewTarget,
      }}
    >
      {children}
    </FounderNavContext.Provider>
  );
}

export function useFounderNav() {
  const ctx = useContext(FounderNavContext);
  if (!ctx) throw new Error('useFounderNav must be used within FounderNavProvider');
  return ctx;
}

export { FOUNDER_SECTIONS };
