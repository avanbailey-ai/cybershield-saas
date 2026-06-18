'use client';

import Link from 'next/link';
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

  const hasReferralActivity =
    stats.clicks > 0 || stats.signups > 0 || stats.conversions > 0 || viralScore > 0;

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
    <div className="p-4 sm:p-6 lg:p-8">
      <section className="mb-8 rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-950/40 to-gray-900/60 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">Refer & Earn</p>
        <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Share CyberShield, earn rewards</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-300">
          Invite teams and founders who need continuous website security monitoring. When they upgrade,
          you earn bonus daily checks and temporary Pro access — no limits on how many people you can refer.
        </p>
      </section>

      <section className="mb-8 rounded-xl border border-gray-800 bg-gray-900/60 p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Your referral link</p>
        <p className="mt-1 text-sm text-gray-400">
          Share this link — referrals are tracked automatically when someone signs up.
        </p>
        <p className="mt-2 text-xs text-gray-600">Referral code: {referralCode}</p>
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
      </section>

      <section className="mb-8 rounded-xl border border-gray-800 bg-gray-900/60 p-6">
        <h2 className="text-lg font-semibold text-white">How rewards work</h2>
        <ol className="mt-4 space-y-4 text-sm text-gray-300">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xs font-bold text-blue-400">
              1
            </span>
            <span>Share your link with anyone who manages a website or client portfolio.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xs font-bold text-blue-400">
              2
            </span>
            <span>They sign up and start monitoring — you are credited when they create an account.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xs font-bold text-blue-400">
              3
            </span>
            <span>
              When they convert to a paid plan, you receive <strong className="text-white">+5 bonus checks per day</strong>{' '}
              and <strong className="text-white">7 days of Pro features</strong>.
            </span>
          </li>
        </ol>
      </section>

      {hasReferralActivity ? (
        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Link clicks', value: stats.clicks },
            { label: 'Signups', value: stats.signups },
            { label: 'Paid conversions', value: stats.conversions },
            { label: 'Referral score', value: viralScore },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
              <p className="mt-2 text-2xl font-bold text-white">{value}</p>
            </div>
          ))}
        </section>
      ) : (
        <section className="mb-8 rounded-xl border border-dashed border-gray-700 bg-gray-900/30 px-6 py-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-gray-700 bg-gray-800 text-gray-500">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z"
              />
            </svg>
          </div>
          <p className="text-base font-semibold text-gray-200">No referrals yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
            Share your link to start earning rewards. Performance metrics appear here once activity begins.
          </p>
        </section>
      )}

      <section className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
        <h2 className="text-lg font-semibold text-white">Your earned rewards</h2>
        <p className="mt-1 text-sm text-gray-400">Displayed as {maskedName} on the leaderboard.</p>
        {(bonusScans > 0 || proActive) ? (
          <ul className="mt-4 space-y-3 text-sm text-gray-300">
            {bonusScans > 0 && (
              <li className="flex justify-between rounded-lg bg-gray-800/50 px-4 py-3">
                <span>Bonus checks per day</span>
                <span className="font-semibold text-green-400">+{bonusScans}</span>
              </li>
            )}
            <li className="flex justify-between rounded-lg bg-gray-800/50 px-4 py-3">
              <span>Pro unlock</span>
              <span className="font-semibold text-blue-400">
                {proActive
                  ? `Active until ${new Date(proUnlockUntil!).toLocaleDateString()}`
                  : 'Not active yet'}
              </span>
            </li>
          </ul>
        ) : (
          <p className="mt-4 text-sm text-gray-500">
            Rewards unlock when referred users convert to a paid plan.
          </p>
        )}
        <p className="mt-4 text-xs text-gray-500">
          Questions? Visit{' '}
          <Link href="/app/settings" className="text-blue-400 hover:text-blue-300">
            Settings
          </Link>{' '}
          or contact support.
        </p>
      </section>
    </div>
  );
}
