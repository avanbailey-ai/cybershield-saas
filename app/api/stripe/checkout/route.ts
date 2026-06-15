import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe/stripe';
import { getPriceId } from '@/lib/billing/plans';

const VALID_PLANS = ['pro', 'growth', 'agency'] as const;
type ValidPlan = (typeof VALID_PLANS)[number];

function validateStripeEnv(): string | null {
  if (!process.env.STRIPE_SECRET_KEY) return 'STRIPE_SECRET_KEY';
  return null;
}

/**
 * POST /api/stripe/checkout
 * Body: { plan: 'pro' | 'growth' | 'agency' }
 * Returns: { url: string } — Stripe Checkout redirect URL
 */
export async function POST(req: Request) {
  try {
    console.log('[checkout] request received');

    const missingEnv = validateStripeEnv();
    if (missingEnv) {
      console.error(`[checkout] ${missingEnv} is not set`);
      return NextResponse.json(
        { error: 'Stripe is not configured', details: `Missing ${missingEnv}` },
        { status: 503 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    console.log('[checkout] body:', body);
    const { plan } = body;
    console.log('[checkout] plan:', plan);

    if (!plan || !(VALID_PLANS as readonly string[]).includes(plan)) {
      return NextResponse.json(
        { error: `Invalid plan: ${plan}. Must be one of: ${VALID_PLANS.join(', ')}` },
        { status: 400 },
      );
    }

    let priceId: string;
    try {
      priceId = getPriceId(plan as ValidPlan);
    } catch (err) {
      console.error('[checkout] price lookup failed:', err);
      return NextResponse.json(
        { error: `Stripe price not configured for plan: ${plan}` },
        { status: 400 },
      );
    }

    if (!priceId || !priceId.startsWith('price_')) {
      console.error('[checkout] invalid priceId:', priceId);
      return NextResponse.json(
        {
          error: `Stripe price not configured for plan: ${plan}. Set STRIPE_PRICE_${plan.toUpperCase()} env var.`,
        },
        { status: 400 },
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://example.com';

    const existingCustomerId = profile?.stripe_customer_id;

    console.log('[checkout] priceId:', priceId);
    console.log('[checkout] baseUrl:', baseUrl);
    console.log('[checkout] userId:', user.id);

    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/dashboard?upgraded=true`,
      cancel_url: `${baseUrl}/dashboard/settings`,
      metadata: { userId: user.id, plan },
      client_reference_id: user.id,
      ...(existingCustomerId ? { customer: existingCustomerId } : { customer_email: user.email }),
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[checkout] unhandled error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Checkout failed', details: message },
      { status: 500 },
    );
  }
}
