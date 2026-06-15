import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { planFromPriceId, type BilledPlan } from '@/lib/billing/plans';
import {
  upsertUserSubscription,
  updateSubscriptionByCustomerId,
} from '@/lib/billing/subscriptionService';
import { getVariant, recordConversion } from '@/lib/analytics/experiments';
import { applyReferralConversionReward } from '@/lib/referrals/rewards';
import { auditLog } from '@/lib/audit/log';
import { logWebhookFailure, logWebhookProcessing } from '@/lib/observability/log';
import { rateLimitWebhook } from '@/lib/rateLimit/limiter';
import { getSeatLimitForPlan } from '@/lib/billing/orgPlans';
import { emitEvent } from '@/lib/brain/eventBus';

async function claimWebhookEvent(
  supabase: ReturnType<typeof createAdminClient>,
  eventId: string,
  eventType: string,
): Promise<boolean> {
  const { error } = await supabase.from('stripe_webhook_events').insert({
    event_id: eventId,
    event_type: eventType,
  });

    if (error) {
      if (error.code === '23505') {
        console.log(`[webhook] duplicate event skipped: ${eventId}`);
        return false;
      }
      if (error.code === '42P01') {
        console.warn('[webhook] stripe_webhook_events table missing — apply migration for idempotency');
        return true;
      }
      console.error('[webhook] idempotency insert failed:', error);
    }

  return true;
}

async function updateOrgFromWebhook(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  plan: BilledPlan,
  customerId: string | null,
  subscriptionId: string | null,
  status?: string,
): Promise<void> {
  const update: Record<string, string | number | null> = {
    plan,
    seat_limit: getSeatLimitForPlan(plan),
  };
  if (customerId) update.stripe_customer_id = customerId;
  if (subscriptionId) update.stripe_subscription_id = subscriptionId;

  const { error } = await supabase.from('organizations').update(update).eq('id', orgId);
  if (error) {
    console.error('[webhook] org update failed', { orgId, error });
  } else {
    console.log(`[webhook] org ${orgId} updated to plan ${plan}`);
    auditLog({
      orgId,
      action: 'billing_webhook',
      metadata: { plan, status: status ?? 'active', customerId, subscriptionId },
    });
  }
}

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

function periodEndFromSubscription(subscription: Stripe.Subscription): string | null {
  const end = subscription.items?.data?.[0]?.current_period_end;
  if (!end) return null;
  return new Date(end * 1000).toISOString();
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
  const webhookStart = Date.now();
  const sourceIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'stripe';
  const webhookRate = rateLimitWebhook(sourceIp);
  if (!webhookRate.allowed) {
    console.warn('[webhook] rate limit exceeded for', sourceIp);
    return NextResponse.json({ received: true });
  }

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

  const shouldProcess = await claimWebhookEvent(supabase, event.id, event.type);
  if (!shouldProcess) {
    return NextResponse.json({ received: true, duplicate: true });
  }

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

        const { data: buyerProfile } = await supabase
          .from('profiles')
          .select('referred_by_code')
          .eq('id', userId)
          .single();

        let currentPeriodEnd: string | null = null;
        if (subscriptionId) {
          try {
            const stripeSub = await getStripe().subscriptions.retrieve(subscriptionId);
            currentPeriodEnd = periodEndFromSubscription(stripeSub);
          } catch (err) {
            console.error('[webhook] Failed to fetch subscription for period_end:', err);
          }
        }

        try {
          await upsertUserSubscription({
            userId,
            plan,
            status: 'active',
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            currentPeriodEnd,
          });
        } catch (error) {
          console.error('[webhook] checkout.session.completed: DB update failed', error);
          logWebhookFailure(event.type, error);
          break;
        }

        console.log(`[webhook] checkout.session.completed: user ${userId} upgraded to ${plan}`);

        auditLog({
          userId,
          action: 'billing_webhook',
          metadata: { event: 'checkout.session.completed', plan, sessionId: session.id },
        });

        const orgId = session.metadata?.orgId;
        if (orgId) {
          await updateOrgFromWebhook(supabase, orgId, plan, customerId, subscriptionId, 'active');
        }

        await supabase.from('analytics_events').insert({
          event_type: 'checkout_completed',
          user_id: userId,
          metadata: {
            plan,
            sessionId: session.id,
            referredByCode: buyerProfile?.referred_by_code ?? null,
          },
        });

        void emitEvent(
          'checkout_completed',
          { plan, sessionId: session.id },
          userId,
          null,
          'stripe',
        );

        if (buyerProfile?.referred_by_code) {
          void applyReferralConversionReward(userId).catch((err) =>
            console.error('[webhook] referral reward failed:', err),
          );
        }

        const checkoutEvents = await supabase
          .from('analytics_events')
          .select('session_id')
          .eq('user_id', userId)
          .eq('event_type', 'checkout_started')
          .order('created_at', { ascending: false })
          .limit(1);
        const analyticsSessionId = checkoutEvents.data?.[0]?.session_id;
        if (analyticsSessionId) {
          for (const expName of ['cta_text', 'paywall_timing'] as const) {
            const { variant } = await getVariant(expName, analyticsSessionId);
            await recordConversion(expName, variant);
          }
        }

        const { error: abandonedErr } = await supabase
          .from('abandoned_checkouts')
          .update({ status: 'converted', converted_at: new Date().toISOString() })
          .eq('session_id', session.id);

        if (abandonedErr) {
          console.error('[webhook] abandoned_checkouts update failed:', abandonedErr);
        }
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`[webhook] checkout.session.expired: session ${session.id} — eligible for recovery email`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string | null;

        if (!customerId) break;

        try {
          await updateSubscriptionByCustomerId(customerId, { status: 'past_due' });
          console.log(`[webhook] invoice.payment_failed: customer ${customerId} marked past_due`);
        } catch (error) {
          console.error('[webhook] invoice.payment_failed: DB update failed', error);
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

        try {
          await updateSubscriptionByCustomerId(customerId, {
            status: 'active',
            ...(plan ? { plan } : {}),
          });
          console.log(`[webhook] invoice.paid: customer ${customerId} marked active${plan ? `, plan → ${plan}` : ''}`);
          if (plan) {
            const { data: orgs } = await supabase
              .from('organizations')
              .select('id')
              .eq('stripe_customer_id', customerId);
            for (const org of orgs ?? []) {
              await updateOrgFromWebhook(supabase, org.id, plan, customerId, null, 'active');
            }
          }
        } catch (error) {
          console.error('[webhook] invoice.paid: DB update failed', error);
          logWebhookFailure(event.type, error);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        try {
          await updateSubscriptionByCustomerId(customerId, {
            plan: 'free',
            status: 'inactive',
            stripeSubscriptionId: null,
          });
          console.log(`[webhook] customer.subscription.deleted: customer ${customerId} downgraded to free`);
          await supabase.from('organizations').update({
            plan: 'free',
            seat_limit: 1,
            stripe_subscription_id: null,
          }).eq('stripe_customer_id', customerId);
          auditLog({ action: 'billing_webhook', metadata: { event: 'subscription.deleted', customerId } });
        } catch (error) {
          console.error('[webhook] customer.subscription.deleted: DB update failed', error);
          logWebhookFailure(event.type, error);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const status = subscription.status;
        const priceId = subscription.items.data[0]?.price?.id;
        const plan = priceId ? planFromPriceId(priceId) : null;

        const update: {
          status: string;
          plan?: BilledPlan;
          stripeSubscriptionId?: string;
          currentPeriodEnd?: string | null;
        } = { status, stripeSubscriptionId: subscription.id, currentPeriodEnd: periodEndFromSubscription(subscription) };
        if (plan && (status === 'active' || status === 'trialing')) {
          update.plan = plan;
        }

        try {
          await updateSubscriptionByCustomerId(customerId, update);
          console.log(`[webhook] customer.subscription.updated: customer ${customerId} status → ${status}${plan ? `, plan → ${plan}` : ''}`);
          if (plan && (status === 'active' || status === 'trialing')) {
            const { data: orgs } = await supabase
              .from('organizations')
              .select('id')
              .eq('stripe_customer_id', customerId);
            for (const org of orgs ?? []) {
              await updateOrgFromWebhook(
                supabase,
                org.id,
                plan,
                customerId,
                subscription.id,
                status,
              );
            }
          }
        } catch (error) {
          console.error('[webhook] customer.subscription.updated: DB update failed', error);
          logWebhookFailure(event.type, error);
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`[webhook] Unhandled error processing event ${event.type}:`, err);
    logWebhookFailure(event.type, err);
  }

  logWebhookProcessing(event.type, Date.now() - webhookStart);
  return NextResponse.json({ received: true });
}
