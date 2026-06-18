'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { readFunnelSession } from '@/lib/funnel/session';
import OnboardingPlans from './OnboardingPlans';

type Step = 'welcome' | 'website' | 'plan';

/** Recommended plan for new monitoring users: Growth (hourly checks + change timeline). */
const RECOMMENDED_PLAN = 'growth' as const;

export default function OnboardingWizard() {
  const [step, setStep] = useState<Step>('welcome');
  const [funnelUrl, setFunnelUrl] = useState<string | null>(null);

  useEffect(() => {
    const session = readFunnelSession();
    if (session?.scanned_site) {
      setFunnelUrl(session.scanned_site);
    }
  }, []);

  if (step === 'welcome') {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/20 ring-1 ring-blue-500/30">
            <svg
              className="h-7 w-7 text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
              />
            </svg>
          </div>
        </div>

        <p className="text-xs font-semibold uppercase tracking-widest text-blue-500">Step 1 of 3</p>
        <h1 className="mt-3 text-3xl font-bold text-white">
          Welcome to CyberShield monitoring
        </h1>
        <p className="mt-4 text-gray-400">
          CyberShield is the memory of your website — continuous tracking of SSL, domain, uptime,
          security posture, and changes. We&apos;ll help you add your first site, then show you the
          Health Center after your first scan.
        </p>

        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={() => setStep('website')}
            className="block w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            Add your first website
          </button>
          <button
            type="button"
            onClick={() => setStep('plan')}
            className="w-full rounded-lg border border-gray-700 px-6 py-3 text-sm font-semibold text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
          >
            Compare monitoring plans
          </button>
        </div>

        <p className="mt-6 text-xs text-gray-600">
          No credit card required for your first scan.
        </p>
      </div>
    );
  }

  if (step === 'website') {
    const addHref = funnelUrl
      ? `/app/websites?add=${encodeURIComponent(funnelUrl)}`
      : '/app/websites';

    return (
      <div className="mx-auto max-w-lg text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-500">Step 2 of 3</p>
        <h1 className="mt-3 text-2xl font-bold text-white">Add a website to monitor</h1>
        <p className="mt-4 text-sm text-gray-400">
          {funnelUrl
            ? `We found ${funnelUrl} from your free scan — add it to start continuous monitoring.`
            : 'Enter your site URL to start SSL, domain, and security monitoring.'}
        </p>

        <div className="mt-8 space-y-3">
          <Link
            href={addHref}
            className="block w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            {funnelUrl ? 'Monitor this website' : 'Go to websites'}
          </Link>
          <p className="text-xs text-gray-500">
            After your first scan completes, open the{' '}
            <span className="text-gray-400">Health Center</span> from your website dashboard for a full status overview.
          </p>
          <button
            type="button"
            onClick={() => setStep('plan')}
            className="w-full rounded-lg border border-gray-700 px-6 py-3 text-sm font-semibold text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
          >
            Choose a plan first
          </button>
          <button
            type="button"
            onClick={() => setStep('welcome')}
            className="text-xs text-gray-500 hover:text-gray-400"
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-500">Step 3 of 3</p>
        <h1 className="mt-2 text-2xl font-bold text-white">Choose how you want to monitor</h1>
        <p className="mt-2 text-sm text-gray-400">
          We recommend <span className="text-white capitalize">{RECOMMENDED_PLAN}</span> for hourly checks, change timeline, and SSL/domain monitoring.
        </p>
        <button
          type="button"
          onClick={() => setStep('website')}
          className="mt-3 text-xs text-gray-500 hover:text-gray-400"
        >
          ← Back
        </button>
      </div>

      <OnboardingPlans />
    </div>
  );
}
