'use client';

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { getSessionId, trackEvent } from '@/lib/analytics/events';

interface AnalyticsContextValue {
  sessionId: string;
}

const AnalyticsContext = createContext<AnalyticsContextValue>({ sessionId: '' });

export function useAnalyticsSession(): AnalyticsContextValue {
  return useContext(AnalyticsContext);
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const sessionId = typeof window !== 'undefined' ? getSessionId() : '';
  const pageStartRef = useRef<number>(Date.now());
  const maxScrollRef = useRef(0);
  const pricingEnterRef = useRef<number | null>(null);

  useEffect(() => {
    pageStartRef.current = Date.now();
    maxScrollRef.current = 0;

    trackEvent('page_view', { path: pathname });

    if (pathname.includes('pricing') || pathname === '/onboarding') {
      pricingEnterRef.current = Date.now();
    }

    return () => {
      const seconds = Math.round((Date.now() - pageStartRef.current) / 1000);
      if (seconds >= 3) {
        trackEvent('time_on_page', { path: pathname, seconds });
      }

      if (
        pricingEnterRef.current &&
        (pathname.includes('pricing') || pathname === '/onboarding')
      ) {
        const dwell = (Date.now() - pricingEnterRef.current) / 1000;
        if (dwell < 10) {
          trackEvent('bounce_pricing', { path: pathname, seconds: Math.round(dwell) });
        }
      }
    };
  }, [pathname]);

  useEffect(() => {
    function onScroll() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const depth = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;
      if (depth > maxScrollRef.current) {
        maxScrollRef.current = depth;
        if (depth >= 25 && depth % 25 === 0) {
          trackEvent('scroll_depth', { path: pathname, depth });
        }
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [pathname]);

  return (
    <AnalyticsContext.Provider value={{ sessionId }}>
      {children}
    </AnalyticsContext.Provider>
  );
}
