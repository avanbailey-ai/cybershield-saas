import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe/stripe';
import { isOwner } from '@/lib/auth/owner';
import { isWorkerAuthorized } from '@/lib/queue/workerAuth';

export const runtime = 'nodejs';

const LIVE_PRODUCTS = {
  pro: { productId: 'prod_UhoHAE43R4sIdG', amount: 7900 },
  growth: { productId: 'prod_UhoHEvSPv2ryxc', amount: 14900 },
  agency: { productId: 'prod_UhoIyI5ixVqsn1', amount: 29900 },
} as const;

/**
 * One-time idempotent setup: create new LIVE recurring prices at 79/149/299.
 * Auth: CRON_SECRET or platform owner session.
 * Returns price IDs only — update Vercel STRIPE_PRICE_* env vars, then redeploy.
 */
export async function POST(request: Request) {
  const cronAuthorized = isWorkerAuthorized(request);
  const setupToken = process.env.STRIPE_PRICE_SETUP_TOKEN?.trim();
  const tokenAuthorized =
    !!setupToken && request.headers.get('x-setup-token') === setupToken;

  if (!cronAuthorized && !tokenAuthorized) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !isOwner(user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  try {
    const stripe = getStripe();
    const prices: Record<string, string> = {};

    for (const [plan, { productId, amount }] of Object.entries(LIVE_PRODUCTS)) {
      const existing = await stripe.prices.list({
        product: productId,
        active: true,
        limit: 100,
      });

      const match = existing.data.find(
        (p) =>
          p.unit_amount === amount &&
          p.recurring?.interval === 'month' &&
          p.livemode,
      );

      if (match) {
        prices[plan] = match.id;
        continue;
      }

      const created = await stripe.prices.create({
        product: productId,
        unit_amount: amount,
        currency: 'usd',
        recurring: { interval: 'month' },
        metadata: { plan, pricing_tier: '2026-06' },
      });
      prices[plan] = created.id;
    }

    return NextResponse.json({
      ok: true,
      prices,
      env: {
        STRIPE_PRICE_PRO: prices.pro,
        STRIPE_PRICE_GROWTH: prices.growth,
        STRIPE_PRICE_AGENCY: prices.agency,
      },
      amountsUsd: { pro: 79, growth: 149, agency: 299 },
    });
  } catch (err) {
    console.error('[setup-stripe-live-prices]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Setup failed' },
      { status: 500 },
    );
  }
}
