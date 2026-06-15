import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { canAccessDashboard } from './permissions';

export async function getProfileForUser(userId: string): Promise<{ plan: string }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single();
  return { plan: data?.plan ?? 'free' };
}

export function dashboardAccessDeniedResponse() {
  return NextResponse.json(
    {
      error: 'SUBSCRIPTION_REQUIRED',
      message: 'A paid plan is required. Upgrade to access the dashboard.',
      upgradeUrl: '/#pricing',
    },
    { status: 403 },
  );
}

export async function requireDashboardAccess(user: User) {
  const { plan } = await getProfileForUser(user.id);
  if (!canAccessDashboard({ email: user.email, plan })) {
    return { allowed: false as const, response: dashboardAccessDeniedResponse(), plan };
  }
  return { allowed: true as const, plan };
}
