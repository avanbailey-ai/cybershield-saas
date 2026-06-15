import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getRedirectPath } from '@/lib/auth/redirect';
import { isOwner } from '@/lib/auth/owner';
import OnboardingPlans from '@/components/onboarding/OnboardingPlans';
import ExitIntentModal from '@/components/conversion/ExitIntentModal';

export const metadata: Metadata = {
  title: 'Choose a Plan — CyberShield',
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  let plan = 'free';
  let subscriptionStatus: string | null = 'inactive';
  if (isOwner(user.email)) {
    plan = 'owner';
    subscriptionStatus = 'active';
  } else {
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, subscription_status')
      .eq('id', user.id)
      .single();
    plan = profile?.plan ?? 'free';
    subscriptionStatus = profile?.subscription_status ?? 'inactive';
  }

  const redirectPath = getRedirectPath({
    email: user.email,
    plan,
    subscription_status: subscriptionStatus,
  });
  if (redirectPath !== '/onboarding') {
    redirect(redirectPath);
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <ExitIntentModal />
      <header className="border-b border-gray-800 px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600">
            <svg
              className="h-5 w-5 text-white"
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
          <span className="text-lg font-bold text-white">CyberShield</span>
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-white">Choose a plan to get started</h1>
          <p className="mt-3 text-gray-400">
            Select a plan to unlock your security monitoring dashboard.
          </p>
        </div>

        <OnboardingPlans />
      </main>
    </div>
  );
}
