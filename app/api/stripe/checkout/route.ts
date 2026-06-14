import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/stripe';
import { STRIPE_PRICE_IDS, isBilledPlan } from '@/lib/billing/plans';

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
        { error: 'Invalid plan. Must be "pro" or "agency".' },
        { status: 400 }
      );
    }

    const priceId = STRIPE_PRICE_IDS[plan];
    if (!priceId) {
      return NextResponse.json(
        { error: `Stripe price not configured for plan "${plan}". Contact support.` },
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

    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
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

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[stripe/checkout]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
