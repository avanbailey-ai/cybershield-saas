import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Payment Received — CyberShield',
};

export default async function CheckoutCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const params = await searchParams;
  const checkoutState = params.checkout ?? 'processing';
  const settingsPath = `/dashboard/settings?checkout=${encodeURIComponent(checkoutState)}`;

  if (user) {
    redirect(settingsPath);
  }

  const loginHref = `/login?redirectTo=${encodeURIComponent(settingsPath)}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <div className="max-w-md rounded-xl border border-gray-800 bg-gray-900/80 p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
          <span className="text-xl text-emerald-400" aria-hidden>
            ✓
          </span>
        </div>
        <h1 className="text-xl font-semibold text-white">Payment received</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-400">
          Your Stripe payment was successful. Please log in to finish loading your upgraded account
          and confirm your plan on Settings.
        </p>
        <Link
          href={loginHref}
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
        >
          Log in to continue
        </Link>
        <p className="mt-4 text-xs text-gray-500">
          Your subscription is linked to the email you used at checkout. If you already have an
          account, use that same email to sign in.
        </p>
      </div>
    </div>
  );
}
