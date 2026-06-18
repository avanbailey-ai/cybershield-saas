'use client';

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  FOUNDER_SECTIONS,
  type FounderSectionId,
  isFounderSectionId,
} from '@/lib/owner/founderNav';

interface FounderNavContextValue {
  section: FounderSectionId;
  setSection: (id: FounderSectionId) => void;
  email: string;
}

const FounderNavContext = createContext<FounderNavContextValue | null>(null);

export function FounderNavProvider({
  email,
  children,
}: {
  email: string;
  children: ReactNode;
}) {
  const [section, setSectionState] = useState<FounderSectionId>('overview');

  const setSection = useCallback((id: FounderSectionId) => {
    setSectionState(id);
    window.history.replaceState(null, '', `#${id}`);
  }, []);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (isFounderSectionId(hash)) {
      setSectionState(hash);
    }
  }, []);

  return (
    <FounderNavContext.Provider value={{ section, setSection, email }}>
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
