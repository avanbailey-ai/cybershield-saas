import { NextResponse } from 'next/server';

import Stripe from 'stripe';

import { getStripe } from '@/lib/stripe/stripe';

import { getMissingStripeEnv, getStripeWebhookSecret } from '@/lib/stripe/env';

import { createAdminClient } from '@/lib/supabase/admin';

import { planFromPriceId, type BilledPlan, type Plan } from '@/lib/billing/plans';

import {

  mapStripeSubscriptionStatus,

  periodEndFromSubscription,

  priceIdFromInvoiceLine,

  shouldDowngradePlanFromStatus,

} from '@/lib/billing/stripeWebhookHelpers';

import {

  upsertUserSubscription,

} from '@/lib/billing/subscriptionService';

import {
  upsertOrgSubscription,
  updateOrgSubscriptionByCustomerId,
  resolveOrgIdFromStripeCustomer,
} from '@/lib/billing/orgSubscriptionService';

import { getVariant, recordConversion } from '@/lib/analytics/experiments';

import { applyReferralConversionReward } from '@/lib/referrals/rewards';

import { auditLog } from '@/lib/audit/log';

import { logWebhookFailure, logWebhookProcessing } from '@/lib/observability/log';

import { logEvent } from '@/lib/observability';

import { recordApiLatency, recordWebhookResult } from '@/lib/observability/metrics';

import { rateLimitWebhook } from '@/lib/rateLimit/limiter';

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



async function syncOrgSubscriptionFromWebhook(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  plan: Plan,
  customerId: string | null,
  subscriptionId: string | null,
  status: string,
  priceId?: string | null,
  currentPeriodEnd?: string | null,
  eventType?: string,
): Promise<void> {
  await upsertOrgSubscription({
    orgId,
    plan,
    status,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    stripePriceId: priceId ?? null,
    currentPeriodEnd: currentPeriodEnd ?? null,
  });

  console.log('[stripe-webhook]', {
    eventType: eventType ?? 'org_subscription_sync',
    orgId,
    newPlan: plan,
    status,
  });

  auditLog({
    orgId,
    action: 'billing_webhook',
    metadata: { plan, status, customerId, subscriptionId },
  });
}



export const runtime = 'nodejs';

function validateStripeEnv(): string | null {
  return getMissingStripeEnv();
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



async function resolveOrgIdForCheckout(

  supabase: ReturnType<typeof createAdminClient>,

  userId: string,

  metadataOrgId?: string | null,

  customerId?: string | null,

): Promise<string | null> {

  if (metadataOrgId) return metadataOrgId;



  if (customerId) {

    const fromCustomer = await resolveOrgIdFromStripeCustomer(customerId);

    if (fromCustomer) return fromCustomer;

  }



  const { data: profile } = await supabase

    .from('profiles')

    .select('default_org_id')

    .eq('id', userId)

    .maybeSingle();



  return profile?.default_org_id ?? null;

}



/**

 * POST /api/stripe/webhook

 *

 * Syncs Stripe events to organization_subscriptions (gating source of truth).

 * Profiles/subscriptions tables are optionally mirrored for display only.

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



  const webhookSecret = getStripeWebhookSecret();
  if (!webhookSecret) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET is not set');

    return NextResponse.json({ received: true });

  }



  let event: Stripe.Event;

  try {

    event = getStripe().webhooks.constructEvent(body, sig, webhookSecret);

  } catch (err) {

    console.error('[webhook] Signature verification failed:', err);

    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });

  }



  console.log('[webhook]', event.type, event.id);

  void logEvent({
    type: 'stripe_webhook_received',
    layer: 'billing',
    metadata: { eventId: event.id, eventType: event.type },
  });

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

        let priceId: string | null = null;

        if (subscriptionId) {

          try {

            const stripeSub = await getStripe().subscriptions.retrieve(subscriptionId);

            currentPeriodEnd = periodEndFromSubscription(stripeSub);

            priceId = stripeSub.items.data[0]?.price?.id ?? null;

          } catch (err) {

            console.error('[webhook] Failed to fetch subscription for period_end:', err);

          }

        }



        const orgId = await resolveOrgIdForCheckout(

          supabase,

          userId,

          session.metadata?.orgId,

          customerId,

        );



        if (orgId) {
          await syncOrgSubscriptionFromWebhook(
            supabase,
            orgId,
            plan,
            customerId,
            subscriptionId,
            'active',
            priceId,
            currentPeriodEnd,
            event.type,
          );

          void logEvent({
            type: 'subscription_updated',
            layer: 'billing',
            userId,
            orgId,
            metadata: { plan, status: 'active', event: 'checkout.session.completed' },
          });

        } else {

          console.warn('[webhook] checkout completed but no org resolved for user', userId);

        }



        // Optional profile mirror for display (not used for gating)

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

          console.error('[webhook] profile mirror update failed (non-fatal)', error);

        }



        console.log(`[webhook] checkout.session.completed: user ${userId} → org ${orgId ?? 'none'} plan ${plan}`);



        auditLog({

          userId,

          orgId: orgId ?? undefined,

          action: 'billing_webhook',

          metadata: { event: 'checkout.session.completed', plan, sessionId: session.id, orgId },

        });



        await supabase.from('analytics_events').insert({

          event_type: 'checkout_completed',

          user_id: userId,

          metadata: {

            plan,

            sessionId: session.id,

            orgId,

            referredByCode: buyerProfile?.referred_by_code ?? null,

          },

        });



        void emitEvent(

          'checkout_completed',

          { plan, sessionId: session.id, orgId },

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
          const orgIds = await updateOrgSubscriptionByCustomerId(customerId, { status: 'past_due' });
          console.log('[stripe-webhook]', {
            eventType: event.type,
            orgId: orgIds[0] ?? null,
            newPlan: null,
            orgIds,
            status: 'past_due',
          });
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



        const priceId = priceIdFromInvoiceLine(invoice.lines.data[0]);

        const plan = priceId ? planFromPriceId(priceId) : null;



        try {

          const orgIds = await updateOrgSubscriptionByCustomerId(customerId, {
            status: 'active',
            ...(plan ? { plan } : {}),
            ...(priceId ? { stripePriceId: priceId } : {}),
          });
          console.log('[stripe-webhook]', {
            eventType: event.type,
            orgId: orgIds[0] ?? null,
            newPlan: plan,
            orgIds,
            status: 'active',
          });
          console.log(`[webhook] invoice.paid: customer ${customerId} → orgs [${orgIds.join(',')}]`);

          void logEvent({
            type: 'subscription_updated',
            layer: 'billing',
            metadata: { customerId, orgIds, status: 'active', plan, event: 'invoice.paid' },
          });

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

          const orgIds = await updateOrgSubscriptionByCustomerId(customerId, {
            plan: 'free',
            status: 'canceled',
            stripeSubscriptionId: null,
          });
          console.log('[stripe-webhook]', {
            eventType: event.type,
            orgId: orgIds[0] ?? null,
            newPlan: 'free',
            orgIds,
            status: 'canceled',
          });
          console.log(`[webhook] customer.subscription.deleted: customer ${customerId} → orgs [${orgIds.join(',')}]`);

          void logEvent({
            type: 'subscription_updated',
            layer: 'billing',
            metadata: { customerId, orgIds, plan: 'free', status: 'canceled', event: 'customer.subscription.deleted' },
          });

          auditLog({ action: 'billing_webhook', metadata: { event: 'subscription.deleted', customerId, orgIds } });

        } catch (error) {

          console.error('[webhook] customer.subscription.deleted: DB update failed', error);

          logWebhookFailure(event.type, error);

        }

        break;

      }



      case 'customer.subscription.updated': {

        const subscription = event.data.object as Stripe.Subscription;

        const customerId = subscription.customer as string;

        const status = mapStripeSubscriptionStatus(subscription.status);

        const priceId = subscription.items.data[0]?.price?.id;

        const plan = priceId ? planFromPriceId(priceId) : null;



        const update: {

          status: string;

          plan?: BilledPlan | 'free';

          stripeSubscriptionId?: string;

          stripePriceId?: string | null;

          currentPeriodEnd?: string | null;

        } = {

          status,

          stripeSubscriptionId: subscription.id,

          stripePriceId: priceId ?? null,

          currentPeriodEnd: periodEndFromSubscription(subscription),

        };



        if (shouldDowngradePlanFromStatus(status)) {

          update.plan = 'free';

        } else if (plan && (status === 'active' || status === 'trialing')) {

          update.plan = plan;

        }



        try {

          const orgIds = await updateOrgSubscriptionByCustomerId(customerId, update);
          const mirrorPlan = update.plan ?? plan ?? 'free';
          console.log('[stripe-webhook]', {
            eventType: event.type,
            orgId: orgIds[0] ?? null,
            newPlan: mirrorPlan,
            orgIds,
            status,
          });
          console.log(`[webhook] customer.subscription.updated: customer ${customerId} → orgs [${orgIds.join(',')}] status ${status}`);

          void logEvent({
            type: 'subscription_updated',
            layer: 'billing',
            metadata: { customerId, orgIds, plan: update.plan, status, event: 'customer.subscription.updated' },
          });

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

    void recordWebhookResult(false);

  }



  logWebhookProcessing(event.type, Date.now() - webhookStart);

  void recordApiLatency('/api/stripe/webhook', Date.now() - webhookStart, 200);

  void recordWebhookResult(true);

  return NextResponse.json({ received: true });

}

