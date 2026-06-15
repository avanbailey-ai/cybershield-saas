import { NextResponse } from 'next/server';

import type { User } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';

import { canAccessDashboard } from './permissions';
import { getRedirectPath } from './redirect';



export async function getProfileForUser(userId: string): Promise<{

  plan: string;

  subscription_status: string | null;

}> {

  const supabase = await createClient();

  const { data } = await supabase

    .from('profiles')

    .select('plan, subscription_status')

    .eq('id', userId)

    .single();

  return {

    plan: data?.plan ?? 'free',

    subscription_status: data?.subscription_status ?? null,

  };

}



export function dashboardAccessDeniedResponse(upgradeUrl = '/onboarding') {
  return NextResponse.json(
    {
      error: 'SUBSCRIPTION_REQUIRED',
      message: 'A paid plan is required. Upgrade to access the dashboard.',
      upgradeUrl,
    },
    { status: 403 },
  );
}



export async function requireDashboardAccess(user: User) {

  const { plan, subscription_status } = await getProfileForUser(user.id);

  if (!canAccessDashboard({ email: user.email, plan, subscription_status })) {
    const upgradeUrl = getRedirectPath({ email: user.email, plan, subscription_status });
    return { allowed: false as const, response: dashboardAccessDeniedResponse(upgradeUrl), plan };
  }

  return { allowed: true as const, plan };

}

