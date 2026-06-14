import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import type { BilledPlan } from '@/lib/billing/plans';

/**
 * POST /api/stripe/webhook
 *
 * Receives Stripe webhook events and syncs subscription state to the profiles
 * table. Uses the Supabase service-role admin client to bypass RLS.
 *
 * IMPORTANT: Always returns 200 even on errors — Stripe retries non-200s.
 */
export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    console.error('[stripe/webhook] Missing stripe-signature header');
    return NextResponse.json({ received: true });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET is not set');
    return NextResponse.json({ received: true });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe/webhook] Signature verification failed:', err);
    // Return 400 only for signature errors so Stripe stops retrying bad payloads
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan as BilledPlan | undefined;
        const customerId = session.customer as string | null;
        const subscriptionId = session.subscription as string | null;

        if (!userId || !plan || !customerId || !subscriptionId) {
          console.error('[stripe/webhook] checkout.session.completed: missing metadata', {
            userId, plan, customerId, subscriptionId,
          });
          break;
        }

        const { error } = await supabase.from('profiles').update({
          plan,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          subscription_status: 'active',
        }).eq('id', userId);

        if (error) {
          console.error('[stripe/webhook] checkout.session.completed: DB update failed', error);
        } else {
          console.log(`[stripe/webhook] checkout.session.completed: user ${userId} upgraded to ${plan}`);
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
          console.error('[stripe/webhook] invoice.payment_failed: DB update failed', error);
        } else {
          console.log(`[stripe/webhook] invoice.payment_failed: customer ${customerId} marked past_due`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { error } = await supabase.from('profiles')
          .update({ plan: 'free', subscription_status: 'inactive' })
          .eq('stripe_customer_id', customerId);

        if (error) {
          console.error('[stripe/webhook] customer.subscription.deleted: DB update failed', error);
        } else {
          console.log(`[stripe/webhook] customer.subscription.deleted: customer ${customerId} downgraded to free`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const status = subscription.status;

        if (status === 'active') {
          const { error } = await supabase.from('profiles')
            .update({ subscription_status: 'active' })
            .eq('stripe_customer_id', customerId);

          if (error) {
            console.error('[stripe/webhook] customer.subscription.updated: DB update failed', error);
          } else {
            console.log(`[stripe/webhook] customer.subscription.updated: customer ${customerId} restored to active`);
          }
        }
        break;
      }

      default:
        // Unhandled event — not an error
        break;
    }
  } catch (err) {
    // Log but do not throw — always return 200 so Stripe doesn't retry
    console.error(`[stripe/webhook] Unhandled error processing event ${event.type}:`, err);
  }

  return NextResponse.json({ received: true });
}
