'use client';

import { useEffect, useState, type ReactNode } from 'react';
import EnterprisePortalSidebar from '@/components/enterprise/EnterprisePortalSidebar';

interface EnterprisePortalShellProps {
  children: ReactNode;
  showOwnerTools?: boolean;
}

export default function EnterprisePortalShell({
  children,
  showOwnerTools = false,
}: EnterprisePortalShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileNavOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0f1e]">
      <div className="hidden shrink-0 lg:block">
        <EnterprisePortalSidebar showOwnerTools={showOwnerTools} />
      </div>

      {mobileNavOpen && (
        <>
          <button
            type="button"
            aria-label="Close navigation menu"
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-[min(100vw-3rem,16rem)] lg:hidden">
            <EnterprisePortalSidebar
              showOwnerTools={showOwnerTools}
              onNavigate={() => setMobileNavOpen(false)}
            />
          </div>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-800 bg-gray-950 px-5 lg:hidden">
          <button
            type="button"
            aria-label="Open navigation menu"
            onClick={() => setMobileNavOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-300 hover:bg-gray-800"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">CyberShield</p>
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-400">Enterprise</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
