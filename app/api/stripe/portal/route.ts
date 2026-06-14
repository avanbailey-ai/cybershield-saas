import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe/stripe';
import { isBilledPlan } from '@/lib/billing/plans';

/**
 * POST /api/stripe/portal
 * Creates a Stripe Customer Portal session for existing subscribers.
 * Returns: { url: string }
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, plan')
      .eq('id', user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing account found. Please subscribe first.' },
        { status: 400 }
      );
    }

    if (!profile.plan || !isBilledPlan(profile.plan)) {
      return NextResponse.json(
        { error: 'No active subscription found.' },
        { status: 400 }
      );
    }

    // Stripe requires a publicly accessible URL for production settings.
    // Use your deployed Vercel URL (e.g. https://cybershield.vercel.app) or custom domain.
    // Do NOT use localhost — Stripe will reject it in dashboard configuration.
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://example.com';

    const portalSession = await getStripe().billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${baseUrl}/dashboard/settings`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    console.error('[stripe/portal]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
