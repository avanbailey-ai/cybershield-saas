import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireEnterpriseAccess } from '@/lib/auth/requireEnterpriseAccess';
import { getOrgDashboardSummary } from '@/lib/enterprise/orgDashboardSummary';
import { denyEnterpriseAdminAccess } from '@/lib/enterprise/enterpriseRbac';
import type { SessionSubscriptionClient } from '@/lib/billing/getSubscriptionAccess';

/** GET /api/enterprise/dashboard-summary — org-wide monitoring aggregates for agency portal */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await requireEnterpriseAccess(
    user,
    supabase as unknown as SessionSubscriptionClient,
  );
  if (!access.allowed) return access.response;

  const rbacDenied = denyEnterpriseAdminAccess(
    access.orgId,
    access.role,
    '/api/enterprise/dashboard-summary',
  );
  if (rbacDenied) return rbacDenied;

  try {
    const summary = await getOrgDashboardSummary(access.orgId);
    return NextResponse.json(summary, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load dashboard summary';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
