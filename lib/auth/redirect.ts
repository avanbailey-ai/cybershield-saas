import { isOwner } from './owner';

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

  if (isActiveSubscription(status) && PAID_PLANS.includes(plan as (typeof PAID_PLANS)[number])) {
    return '/dashboard';
  }

  if (plan !== 'free' && !isActiveSubscription(status)) {
    return '/pricing';
  }

  return '/onboarding';
}

type ProfileRow = { plan?: string | null; subscription_status?: string | null };

export type SessionSupabaseClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string; email?: string | null } | null };
    }>;
  };
  from: (relation: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        single: () => PromiseLike<{ data: ProfileRow | null }>;
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

  if (isOwner(user.email)) {
    return '/dashboard/admin';
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, subscription_status')
    .eq('id', user.id)
    .single();

  return getRedirectPath({
    email: user.email,
    plan: profile?.plan ?? 'free',
    subscription_status: profile?.subscription_status ?? 'inactive',
  });
}
