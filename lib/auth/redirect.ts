import { isOwner } from './owner';
import { canAccessEnterprise } from './permissions';
import type { UserForFeatureGate } from './featureGate';
import type { OrgRole } from '@/lib/auth/rbac';

export type UserForRedirect = UserForFeatureGate;



const PAID_PLANS = ['pro', 'growth', 'agency'] as const;



function isActiveSubscription(status: string | null | undefined): boolean {

  return status === 'active' || status === 'trialing';

}



export function getRedirectPath(
  user: UserForRedirect | null,
  orgRole?: OrgRole | null,
): string {

  if (!user) return '/login';

  if (isOwner(user.email)) return '/dashboard/admin';



  if (canAccessEnterprise(user, orgRole)) {
    return '/enterprise/portal';
  }



  const plan = user.plan ?? 'free';

  const status = user.subscription_status ?? 'inactive';



  if (isActiveSubscription(status) && PAID_PLANS.includes(plan as (typeof PAID_PLANS)[number])) {

    return '/app';

  }



  if (plan !== 'free' && !isActiveSubscription(status)) {

    return '/pricing';

  }



  return '/app';

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

