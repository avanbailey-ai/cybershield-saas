'use client';

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  FOUNDER_SECTIONS,
  type FounderSectionId,
  resolveFounderSection,
} from '@/lib/owner/founderNav';
import type { FounderCommandCenterData } from '@/lib/owner/founderCommandCenterTypes';
import type { FounderOsV6Data } from '@/lib/owner/founderOsV6';

export interface FounderReviewTarget {
  prospectId?: string;
  draftId?: string;
  focus?: 'send-queue' | 'prospect' | 'find-customers';
}

interface FounderNavContextValue {
  section: FounderSectionId;
  setSection: (id: FounderSectionId | string) => void;
  email: string;
  commandCenter: FounderCommandCenterData;
  refreshCommandCenter: () => Promise<void>;
  /** @deprecated Legacy V6 payload — unmounted views only */
  founderData: FounderOsV6Data;
  /** @deprecated Alias for refreshCommandCenter */
  refreshFounderData: () => Promise<void>;
  reviewTarget: FounderReviewTarget | null;
  openProspectsReview: (target: FounderReviewTarget) => void;
  openFindCustomers: () => void;
  clearReviewTarget: () => void;
}

const FounderNavContext = createContext<FounderNavContextValue | null>(null);

export function FounderNavProvider({
  email,
  initialCommandCenter,
  initialLegacyFounder,
  children,
}: {
  email: string;
  initialCommandCenter: FounderCommandCenterData;
  initialLegacyFounder: FounderOsV6Data;
  children: ReactNode;
}) {
  const [section, setSectionState] = useState<FounderSectionId>('overview');
  const [commandCenter, setCommandCenter] = useState(initialCommandCenter);
  const [reviewTarget, setReviewTarget] = useState<FounderReviewTarget | null>(null);

  const setSection = useCallback((id: FounderSectionId | string) => {
    const resolved = resolveFounderSection(id) ?? 'overview';
    setSectionState(resolved);
    window.history.replaceState(null, '', `#${resolved}`);
  }, []);

  const openProspectsReview = useCallback((target: FounderReviewTarget) => {
    setReviewTarget(target);
    setSectionState('sales');
    window.history.replaceState(null, '', '#sales');
  }, []);

  const openFindCustomers = useCallback(() => {
    setReviewTarget({ focus: 'find-customers' });
    setSectionState('sales');
    window.history.replaceState(null, '', '#sales');
  }, []);

  const clearReviewTarget = useCallback(() => setReviewTarget(null), []);

  const refreshCommandCenter = useCallback(async () => {
    const res = await fetch('/api/owner/command-center');
    const json = await res.json();
    if (json.data) setCommandCenter(json.data);
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
        commandCenter,
        refreshCommandCenter,
        founderData: initialLegacyFounder,
        refreshFounderData: refreshCommandCenter,
        reviewTarget,
        openProspectsReview,
        openFindCustomers,
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
