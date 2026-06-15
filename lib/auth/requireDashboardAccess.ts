import { NextResponse } from 'next/server';

import type { User } from '@supabase/supabase-js';

import { getSubscriptionAccess } from '@/lib/billing/getSubscriptionAccess';
import { getRedirectPath } from './redirect';

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
  const access = await getSubscriptionAccess(user.id, user.email);

  if (!access.canAccessDashboard) {
    const upgradeUrl = getRedirectPath({
      email: user.email,
      plan: access.plan,
      subscription_status: access.status,
    });
    return { allowed: false as const, response: dashboardAccessDeniedResponse(upgradeUrl), plan: access.plan };
  }

  return { allowed: true as const, plan: access.plan };
}
