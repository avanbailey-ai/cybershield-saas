import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe/stripe';
import { getPriceId, isBilledPlan } from '@/lib/billing/plans';

/**
 * POST /api/stripe/checkout
 * Body: { plan: 'pro' | 'agency' }
 * Returns: { url: string } — Stripe Checkout redirect URL
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { plan } = body;

    if (!plan || !isBilledPlan(plan)) {
      return NextResponse.json(
        { error: 'Invalid plan. Must be "pro", "growth", or "agency".' },
        { status: 400 }
      );
    }

    let priceId: string;
    try {
      priceId = getPriceId(plan);
    } catch {
      return NextResponse.json(
        { error: 'Stripe pricing not configured for this plan' },
        { status: 503 }
      );
    }

    // Fetch existing stripe_customer_id from profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    // Stripe requires a publicly accessible URL for production settings.
    // Use your deployed Vercel URL (e.g. https://cybershield.vercel.app) or custom domain.
    // Do NOT use localhost — Stripe will reject it in dashboard configuration.
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://example.com';

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId: user.id, plan },
      client_reference_id: user.id,
      customer_email: profile?.stripe_customer_id ? undefined : user.email ?? undefined,
      success_url: `${baseUrl}/dashboard?upgraded=true`,
      cancel_url: `${baseUrl}/dashboard/settings`,
    };

    if (profile?.stripe_customer_id) {
      sessionParams.customer = profile.stripe_customer_id;
    }

    const session = await getStripe().checkout.sessions.create(sessionParams);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[stripe/checkout]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
