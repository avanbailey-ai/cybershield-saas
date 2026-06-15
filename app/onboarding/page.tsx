import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { SessionSupabaseClient } from '@/lib/auth/redirect';
import { getRedirectPathForSession } from '@/lib/auth/redirectServer';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';

export const metadata: Metadata = {
  title: 'Get Started — CyberShield',
};

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const redirectPath = await getRedirectPathForSession(
    supabase as unknown as SessionSupabaseClient,
  );
  if (redirectPath !== '/onboarding') {
    redirect(redirectPath);
  }

  return (
    <div className="min-h-screen bg-gray-950">
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
        <OnboardingWizard />
      </main>
    </div>
  );
}
