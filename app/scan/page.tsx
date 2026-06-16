import type { Metadata } from 'next';

import Link from 'next/link';

import ScanInput from '@/components/landing/ScanInput';
import ReportProblemWidget from '@/components/beta/ReportProblemWidget';

export const metadata: Metadata = {
  title: 'Free Security Scan — CyberShield',
  description: 'Scan any website for free. No login required.',
};

export default function ScanPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <header className="border-b border-gray-800/60 bg-[#0a0f1e]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-white">CyberShield</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:text-white"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      <main>
        <ScanInput showUpgradeCta />
      </main>
      <ReportProblemWidget />
    </div>
  );
}
