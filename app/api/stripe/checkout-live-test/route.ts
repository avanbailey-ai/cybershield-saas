import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canUseLiveCheckoutTest } from '@/lib/auth/liveCheckoutTest';
import { getStripe } from '@/lib/stripe/stripe';
import { getMissingStripeEnv } from '@/lib/stripe/env';
import { getOrCreateLiveCheckoutTestPriceId } from '@/lib/stripe/liveCheckoutTestPrice';
import { getActiveOrgId } from '@/lib/org/context';
import { ensureUserOrg } from '@/lib/org/migrateExistingUsers';

export const runtime = 'nodejs';

/**
 * POST /api/stripe/checkout-live-test
 * Owner or live-checkout-test accounts only — $1 live Stripe subscription checkout.
 */
export async function POST() {
  try {
    const missingEnv = getMissingStripeEnv();
    if (missingEnv) {
      console.error(`[checkout-live-test] ${missingEnv} is not set`);
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

    if (!canUseLiveCheckoutTest(user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const priceId = await getOrCreateLiveCheckoutTestPriceId();

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, referred_by_code')
      .eq('id', user.id)
      .single();

    await ensureUserOrg(user.id, user.email ?? null);
    const orgId = await getActiveOrgId(user.id);

    if (!orgId) {
      console.warn('[checkout-live-test] no org resolved for user', user.id);
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

    let orgCustomerId: string | null = null;
    if (orgId) {
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
    }

    const existingCustomerId = orgCustomerId ?? profile?.stripe_customer_id;

    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/dashboard/settings?checkout=processing`,
      cancel_url: `${baseUrl}/#pricing`,
      metadata: {
        userId: user.id,
        plan: 'pro',
        liveCheckoutTest: 'true',
        ...(orgId ? { orgId } : {}),
      },
      client_reference_id: user.id,
      ...(existingCustomerId ? { customer: existingCustomerId } : { customer_email: user.email }),
    });

    console.log('[checkout-live-test] session created', {
      sessionId: session.id,
      userId: user.id,
      orgId,
      priceId,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[checkout-live-test] unhandled error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Checkout failed', details: message },
      { status: 500 },
    );
  }
}
