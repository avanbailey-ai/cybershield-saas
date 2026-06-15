'use client';

import { useState } from 'react';
import Link from 'next/link';
import OnboardingPlans from './OnboardingPlans';

type Step = 'welcome' | 'plan';

export default function OnboardingWizard() {
  const [step, setStep] = useState<Step>('welcome');

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

        <p className="text-xs font-semibold uppercase tracking-widest text-blue-500">Step 1 of 2</p>
        <h1 className="mt-3 text-3xl font-bold text-white">
          Find security issues on your website in seconds
        </h1>
        <p className="mt-4 text-gray-400">
          CyberShield scans your site, scores its security, and shows you exactly what to fix.
        </p>

        <div className="mt-8 space-y-3">
          <Link
            href="/scan"
            className="block w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            Start free — scan now
          </Link>
          <button
            type="button"
            onClick={() => setStep('plan')}
            className="w-full rounded-lg border border-gray-700 px-6 py-3 text-sm font-semibold text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
          >
            Set up continuous monitoring
          </button>
        </div>

        <p className="mt-6 text-xs text-gray-600">
          No credit card required for your first scan.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-500">Step 2 of 2</p>
        <h1 className="mt-2 text-2xl font-bold text-white">Choose how you want to monitor</h1>
        <p className="mt-2 text-sm text-gray-400">
          Pick a plan for ongoing scans and alerts, or try a one-time free scan.
        </p>
        <button
          type="button"
          onClick={() => setStep('welcome')}
          className="mt-3 text-xs text-gray-500 hover:text-gray-400"
        >
          ← Back
        </button>
      </div>

      <OnboardingPlans />
    </div>
  );
}
