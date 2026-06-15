import { isOwner } from './owner';

import { getSubscriptionAccessFromSession } from '@/lib/billing/getSubscriptionAccess';



export type UserForRedirect = {

  email?: string | null;

  plan?: string | null;

  subscription_status?: string | null;

};



const PAID_PLANS = ['pro', 'growth', 'agency'] as const;



function isActiveSubscription(status: string | null | undefined): boolean {

  return status === 'active' || status === 'trialing';

}



export function getRedirectPath(user: UserForRedirect | null): string {

  if (!user) return '/login';

  if (isOwner(user.email)) return '/dashboard/admin';



  const plan = user.plan ?? 'free';

  const status = user.subscription_status ?? 'inactive';



  if (isActiveSubscription(status) && plan === 'agency') {

    return '/enterprise/portal';

  }



  if (isActiveSubscription(status) && PAID_PLANS.includes(plan as (typeof PAID_PLANS)[number])) {

    return '/app';

  }



  if (plan !== 'free' && !isActiveSubscription(status)) {

    return '/pricing';

  }



  return '/onboarding';

}



export type SessionSupabaseClient = {

  auth: {

    getUser: () => Promise<{

      data: { user: { id: string; email?: string | null } | null };

    }>;

  };

  from: (relation: string) => {

    select: (columns: string) => {

      eq: (column: string, value: string) => {

        maybeSingle: () => PromiseLike<{ data: { plan?: string | null; status?: string | null } | null }>;

      };

    };

  };

};



export async function getRedirectPathForSession(

  supabase: SessionSupabaseClient,

): Promise<string> {

  const {

    data: { user },

  } = await supabase.auth.getUser();



  if (!user) return '/login';



  const access = await getSubscriptionAccessFromSession(supabase, user.id, user.email);

  return getRedirectPath({

    email: user.email,

    plan: access.plan,

    subscription_status: access.status,

  });

}


