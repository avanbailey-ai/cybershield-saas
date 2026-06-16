import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { canAccessEnterprise } from '@/lib/auth/permissions';
import { ORG_CONTEXT_COOKIE, resolveOrgSessionContextFromSession } from '@/lib/org/sessionContext';
import type { SessionSubscriptionClient } from '@/lib/billing/getSubscriptionAccess';
import { formatScanFrequency, PLAN_LIMITS } from '@/lib/billing/plans';
import { formatWebsiteLimit } from '@/lib/billing/plans';

export const metadata: Metadata = {
  title: 'Welcome to Enterprise — CyberShield',
};

export default async function EnterpriseOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/enterprise/login?redirectTo=/enterprise/onboarding');
  }

  const cookieStore = await cookies();
  const cookieOrgId = cookieStore.get(ORG_CONTEXT_COOKIE)?.value ?? null;

  const orgCtx = await resolveOrgSessionContextFromSession(
    supabase as unknown as SessionSubscriptionClient,
    user.id,
    user.email,
    cookieOrgId,
  );

  if (
    !canAccessEnterprise(
      {
        email: user.email,
        plan: orgCtx.access.plan,
        subscription_status: orgCtx.access.status,
      },
      orgCtx.role,
    )
  ) {
    redirect('/app');
  }

  const params = await searchParams;
  const fromCheckout = params.checkout === 'success';
  const limits = PLAN_LIMITS.agency;

  return (
    <div className="min-h-screen bg-[#0a0f1e]">
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
          <span className="text-lg font-bold text-white">CyberShield Enterprise</span>
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-16">
        {fromCheckout && (
          <div className="mb-8 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
            Your Agency plan is active. Welcome to CyberShield Enterprise.
          </div>
        )}

        <p className="text-xs font-semibold uppercase tracking-widest text-blue-500">Agency plan</p>
        <h1 className="mt-3 text-3xl font-bold text-white">Your enterprise security command center</h1>
        <p className="mt-4 text-gray-400">
          You now have access to team management, hourly automated monitoring, and unlimited website
          tracking — all in a dedicated enterprise dashboard separate from the standard SMB product.
        </p>

        <ul className="mt-8 space-y-4">
          {[
            formatWebsiteLimit(limits.websites),
            formatScanFrequency(limits.scanFrequency),
            `${limits.maxScansPerDay} scans per day`,
            'Team seats and role-based access',
            'Dedicated enterprise portal',
          ].map((feature) => (
            <li key={feature} className="flex items-start gap-3 text-sm text-gray-300">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-blue-400">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              {feature}
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/enterprise/portal"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            Enter enterprise dashboard
          </Link>
          <Link
            href="/enterprise/portal/websites"
            className="inline-flex items-center justify-center rounded-lg border border-gray-700 px-6 py-3 text-sm font-semibold text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
          >
            Add websites first
          </Link>
        </div>
      </main>
    </div>
  );
}
