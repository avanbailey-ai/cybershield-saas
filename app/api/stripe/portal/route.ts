import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

import { getStripe } from '@/lib/stripe/stripe';

import { getMissingStripeEnv } from '@/lib/stripe/env';

import { isBilledPlan } from '@/lib/billing/plans';

import { getActiveOrgId } from '@/lib/org/context';

import { requirePermission } from '@/lib/auth/rbac';

import { getOrgSubscription } from '@/lib/billing/orgSubscriptionService';

import { isSubscriptionActive } from '@/lib/billing/subscriptionService';
import { ensureUserOrg } from '@/lib/org/migrateExistingUsers';



export const runtime = 'nodejs';

/**
 * POST /api/stripe/portal
 * Creates a Stripe Customer Portal session for the active org subscription.
 * Returns: { url: string }
 */

export async function POST() {

  try {

    const missingEnv = getMissingStripeEnv();
    if (missingEnv) {
      console.error(`[stripe/portal] ${missingEnv} is not set`);
      return NextResponse.json(
        { error: 'Stripe is not configured', details: `Missing ${missingEnv}` },
        { status: 503 },
      );
    }

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();



    if (!user) {

      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    }



    await ensureUserOrg(user.id, user.email ?? null);
    const orgId = await getActiveOrgId(user.id);

    if (!orgId) {

      return NextResponse.json({ error: 'No organization found.' }, { status: 400 });

    }



    try {

      await requirePermission(user.id, orgId, 'billing');

    } catch {

      return NextResponse.json({ error: 'Forbidden: billing permission required' }, { status: 403 });

    }



    const subscription = await getOrgSubscription(orgId);



    if (!subscription.stripeCustomerId) {

      return NextResponse.json(

        { error: 'No billing account found. Please subscribe first.' },

        { status: 400 }

      );

    }



    if (!isBilledPlan(subscription.plan) || !isSubscriptionActive(subscription.status)) {

      return NextResponse.json(

        { error: 'No active subscription found.' },

        { status: 400 }

      );

    }



    const baseUrl =

      process.env.NEXT_PUBLIC_SITE_URL ||

      process.env.NEXT_PUBLIC_APP_URL ||

      'https://example.com';



    const portalSession = await getStripe().billingPortal.sessions.create({

      customer: subscription.stripeCustomerId,

      return_url: `${baseUrl}/dashboard/settings`,

    });



    return NextResponse.json({ url: portalSession.url });

  } catch (err) {

    console.error('[stripe/portal]', err);

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });

  }

}

