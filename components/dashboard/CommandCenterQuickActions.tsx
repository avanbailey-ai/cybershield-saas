'use client';

import Link from 'next/link';
import ScanAllButton from '@/components/dashboard/ScanAllButton';

const actionClass =
  'inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-2.5 text-sm font-medium text-gray-200 transition-colors hover:border-gray-600 hover:bg-gray-800 hover:text-white sm:w-auto sm:min-h-0';

export default function CommandCenterQuickActions() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
      <ScanAllButton
        label="Run Scan"
        className={`${actionClass} border-blue-500/30 bg-blue-600 text-white hover:border-blue-500/50 hover:bg-blue-500`}
      />
      <Link href="/app/reports" className={actionClass}>
        View Reports
      </Link>
      <Link href="/app/websites" className={actionClass}>
        Open Health Center
      </Link>
      <Link href="/app/alerts" className={actionClass}>
        View Alerts
      </Link>
      <Link href="/app/websites" className={actionClass}>
        Add Website
      </Link>
      <Link
        href="/app/settings"
        className={`${actionClass} border-blue-500/30 bg-blue-500/10 text-blue-300 hover:border-blue-500/50 hover:bg-blue-500/20 hover:text-blue-200`}
      >
        Upgrade Plan
      </Link>
    </div>
  );
}
