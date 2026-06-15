'use client';

import Link from 'next/link';

export default function EnterpriseHeader() {
  return (
    <header className="border-b border-gray-800/60 bg-[#0a0f1e]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <span className="text-lg font-bold text-white">CyberShield</span>
          <span className="rounded bg-blue-600/20 px-2 py-0.5 text-xs font-medium text-blue-300">Enterprise</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/enterprise/pricing" className="text-gray-400 hover:text-white">
            Pricing
          </Link>
          <Link href="/enterprise/case-studies" className="hidden text-gray-400 hover:text-white sm:inline">
            Case Studies
          </Link>
          <Link
            href="/enterprise/lead"
            className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500"
          >
            Contact Sales
          </Link>
        </nav>
      </div>
    </header>
  );
}
