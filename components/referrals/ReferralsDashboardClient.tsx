'use client';

import { useState } from 'react';

interface ReferralsDashboardClientProps {
  referralCode: string;
  referralLink: string;
  maskedName: string;
  viralScore: number;
  bonusScans: number;
  proUnlockUntil: string | null;
  stats: {
    clicks: number;
    signups: number;
    conversions: number;
  };
}

export default function ReferralsDashboardClient({
  referralCode,
  referralLink,
  maskedName,
  viralScore,
  bonusScans,
  proUnlockUntil,
  stats,
}: ReferralsDashboardClientProps) {
  const [copied, setCopied] = useState(false);

  const proActive =
    proUnlockUntil !== null && new Date(proUnlockUntil) > new Date();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Referral Program</h1>
        <p className="mt-2 text-sm text-gray-400">
          Invite others to CyberShield and earn bonus scans + temporary Pro access when they upgrade.
        </p>
      </div>

      <div className="mb-8 rounded-xl border border-gray-800 bg-gray-900/60 p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Your referral link</p>
        <p className="mt-1 text-sm text-gray-400">Code: {referralCode}</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            readOnly
            value={referralLink}
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-2.5 text-sm text-gray-300"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
          >
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Clicks', value: stats.clicks },
          { label: 'Signups', value: stats.signups },
          { label: 'Conversions', value: stats.conversions },
          { label: 'Viral Score', value: viralScore },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
        <h2 className="text-lg font-semibold text-white">Earned Rewards</h2>
        <p className="mt-1 text-sm text-gray-400">Displayed as {maskedName} on the leaderboard.</p>
        <ul className="mt-4 space-y-3 text-sm text-gray-300">
          <li className="flex justify-between rounded-lg bg-gray-800/50 px-4 py-3">
            <span>Bonus scans per day</span>
            <span className="font-semibold text-green-400">+{bonusScans}</span>
          </li>
          <li className="flex justify-between rounded-lg bg-gray-800/50 px-4 py-3">
            <span>Pro unlock</span>
            <span className="font-semibold text-blue-400">
              {proActive
                ? `Active until ${new Date(proUnlockUntil!).toLocaleDateString()}`
                : 'Not active'}
            </span>
          </li>
        </ul>
        <p className="mt-4 text-xs text-gray-500">
          Earn +5 bonus scans and 7 days of Pro features when a referred user converts to a paid plan.
        </p>
      </div>
    </div>
  );
}
