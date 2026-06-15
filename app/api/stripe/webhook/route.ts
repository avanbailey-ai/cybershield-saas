import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { planFromPriceId, type BilledPlan } from '@/lib/billing/plans';

function validateStripeEnv(): string | null {
  if (!process.env.STRIPE_SECRET_KEY) return 'STRIPE_SECRET_KEY';
  return null;
}

async function resolvePlanFromSession(session: Stripe.Checkout.Session): Promise<BilledPlan | null> {
  const metadataPlan = session.metadata?.plan;
  if (metadataPlan === 'pro' || metadataPlan === 'growth' || metadataPlan === 'agency') {
    return metadataPlan;
  }

  try {
    const lineItems = await getStripe().checkout.sessions.listLineItems(session.id, { limit: 1 });
    const priceId = lineItems.data[0]?.price?.id;
    if (priceId) return planFromPriceId(priceId);
  } catch (err) {
    console.error('[webhook] Failed to resolve plan from checkout line items:', err);
  }

  return null;
}

/**
 * POST /api/stripe/webhook
 *
 * Receives Stripe webhook events and syncs subscription state to the profiles
 * table. Uses the Supabase service-role admin client to bypass RLS.
 *
 * IMPORTANT: Always returns 200 even on errors — Stripe retries non-200s.
 */
export async function POST(req: Request) {
  const missingEnv = validateStripeEnv();
  if (missingEnv) {
    console.error(`[webhook] ${missingEnv} is not set`);
    return NextResponse.json({ received: true });
  }

  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    console.error('[webhook] Missing stripe-signature header');
    return NextResponse.json({ received: true });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET is not set');
    return NextResponse.json({ received: true });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log('[webhook]', event.type, event.id);

  const supabase = createAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId ?? session.client_reference_id;
        const plan = await resolvePlanFromSession(session);
        const customerId = session.customer as string | null;
        const subscriptionId = session.subscription as string | null;

        if (!userId) {
          console.error('[webhook] Missing userId in session metadata', session.id);
          break;
        }

        if (!plan) {
          console.error('[webhook] Could not resolve plan for session', session.id);
          break;
        }

        const { error } = await supabase.from('profiles').update({
          plan,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          subscription_status: 'active',
        }).eq('id', userId);

        if (error) {
          console.error('[webhook] checkout.session.completed: DB update failed', error);
        } else {
          console.log(`[webhook] checkout.session.completed: user ${userId} upgraded to ${plan}`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string | null;

        if (!customerId) break;

        const { error } = await supabase.from('profiles')
          .update({ subscription_status: 'past_due' })
          .eq('stripe_customer_id', customerId);

        if (error) {
          console.error('[webhook] invoice.payment_failed: DB update failed', error);
        } else {
          console.log(`[webhook] invoice.payment_failed: customer ${customerId} marked past_due`);
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string | null;

        if (!customerId) break;

        let priceId: string | null = null;
        const pricingPrice = invoice.lines.data[0]?.pricing?.price_details?.price;
        if (typeof pricingPrice === 'string') {
          priceId = pricingPrice;
        } else if (pricingPrice && typeof pricingPrice === 'object' && 'id' in pricingPrice) {
          priceId = (pricingPrice as Stripe.Price).id;
        }

        const plan = priceId ? planFromPriceId(priceId) : null;
        const update: Record<string, string> = { subscription_status: 'active' };
        if (plan) update.plan = plan;

        const { error } = await supabase.from('profiles')
          .update(update)
          .eq('stripe_customer_id', customerId);

        if (error) {
          console.error('[webhook] invoice.paid: DB update failed', error);
        } else {
          console.log(`[webhook] invoice.paid: customer ${customerId} marked active${plan ? `, plan → ${plan}` : ''}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { error } = await supabase.from('profiles').update({
          plan: 'free',
          subscription_status: 'inactive',
          stripe_subscription_id: null,
        }).eq('stripe_customer_id', customerId);

        if (error) {
          console.error('[webhook] customer.subscription.deleted: DB update failed', error);
        } else {
          console.log(`[webhook] customer.subscription.deleted: customer ${customerId} downgraded to free`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const status = subscription.status;
        const priceId = subscription.items.data[0]?.price?.id;
        const plan = priceId ? planFromPriceId(priceId) : null;

        const update: Record<string, string | null> = { subscription_status: status };
        if (plan && (status === 'active' || status === 'trialing')) {
          update.plan = plan;
        }

        const { error } = await supabase.from('profiles')
          .update(update)
          .eq('stripe_customer_id', customerId);

        if (error) {
          console.error('[webhook] customer.subscription.updated: DB update failed', error);
        } else {
          console.log(`[webhook] customer.subscription.updated: customer ${customerId} status → ${status}${plan ? `, plan → ${plan}` : ''}`);
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`[webhook] Unhandled error processing event ${event.type}:`, err);
  }

  return NextResponse.json({ received: true });
}
