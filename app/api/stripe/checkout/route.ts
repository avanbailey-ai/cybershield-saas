import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe/stripe';
import { getActiveOrgId } from '@/lib/org/context';
import { requirePermission } from '@/lib/auth/rbac';
import { getPriceId } from '@/lib/billing/plans';
import { rateLimitCheckout, rateLimitHeaders } from '@/lib/rateLimit/limiter';
import { logCheckoutLatency } from '@/lib/observability/log';

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
  const start = Date.now();
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

    const checkoutRate = rateLimitCheckout(user.id);
    if (!checkoutRate.allowed) {
      logCheckoutLatency(Date.now() - start, 429, user.id);
      return NextResponse.json(
        { error: 'Too many checkout attempts. Please wait before trying again.' },
        { status: 429, headers: rateLimitHeaders(checkoutRate) },
      );
    }

    const body = await req.json();
    console.log('[checkout] body:', body);
    const { plan, orgId: requestedOrgId } = body as { plan?: string; orgId?: string };
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
      .select('stripe_customer_id, referred_by_code')
      .eq('id', user.id)
      .single();

    let orgId: string | null = requestedOrgId ?? null;
    let orgCustomerId: string | null = null;

    if (orgId) {
      try {
        await requirePermission(user.id, orgId, 'billing');
      } catch {
        return NextResponse.json({ error: 'Forbidden: billing permission required' }, { status: 403 });
      }
      const admin = createAdminClient();
      const { data: orgSub } = await admin
        .from('organization_subscriptions')
        .select('stripe_customer_id')
        .eq('org_id', orgId)
        .maybeSingle();
      orgCustomerId = orgSub?.stripe_customer_id ?? null;
      if (!orgCustomerId) {
        const { data: org } = await admin
          .from('organizations')
          .select('stripe_customer_id')
          .eq('id', orgId)
          .single();
        orgCustomerId = org?.stripe_customer_id ?? null;
      }
    } else {
      orgId = await getActiveOrgId(user.id);
    }

    if (!orgId) {
      console.warn('[checkout] no org resolved for user', user.id);
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL;

    if (!baseUrl) {
      return NextResponse.json(
        { error: 'Site URL not configured', details: 'Set NEXT_PUBLIC_SITE_URL env var.' },
        { status: 503 },
      );
    }

    const existingCustomerId = orgCustomerId ?? profile?.stripe_customer_id;

    console.log('[checkout] priceId:', priceId);
    console.log('[checkout] baseUrl:', baseUrl);
    console.log('[checkout] orgId:', orgId);
    console.log('[checkout] existingCustomerId:', existingCustomerId ?? 'new');

    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url:
        plan === 'agency'
          ? `${baseUrl}/enterprise/onboarding?checkout=success`
          : `${baseUrl}/dashboard/settings?checkout=processing`,
      cancel_url: `${baseUrl}/#pricing`,
      metadata: {
        userId: user.id,
        plan,
        referredByCode: profile?.referred_by_code ?? '',
        ...(orgId ? { orgId } : {}),
      },
      client_reference_id: user.id,
      ...(existingCustomerId ? { customer: existingCustomerId } : { customer_email: user.email }),
    });

    void (async () => {
      try {
        const admin = createAdminClient();
        await admin.from('analytics_events').insert({
          event_type: 'checkout_started',
          user_id: user.id,
          metadata: { plan, session_id: session.id },
        });
        await admin.from('abandoned_checkouts').insert({
          user_id: user.id,
          email: user.email ?? '',
          plan,
          session_id: session.id,
          status: 'started',
        });
      } catch (err) {
        console.error('[checkout] analytics/abandoned_checkouts failed (non-fatal):', err);
      }
    })();

    logCheckoutLatency(Date.now() - start, 200, user.id);
    return NextResponse.json({ url: session.url }, { headers: rateLimitHeaders(checkoutRate) });
  } catch (error) {
    console.error('[checkout] unhandled error:', error);
    logCheckoutLatency(Date.now() - start, 500);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Checkout failed', details: message },
      { status: 500 },
    );
  }
}
