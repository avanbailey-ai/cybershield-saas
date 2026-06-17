import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isOwner } from '@/lib/auth/owner';
import { ensureUserOrg } from '@/lib/org/migrateExistingUsers';
import { getOrgSubscription } from '@/lib/billing/orgSubscriptionService';

export const runtime = 'nodejs';

/**
 * POST /api/owner/create-live-test-account
 * Owner-only: creates a confirmed test user for live Stripe checkout E2E.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isOwner(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const timestamp = Date.now();
  const email = `avanbailey+live-checkout-test-${timestamp}@gmail.com`;
  const password = randomBytes(18).toString('base64url');

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    console.error('[owner/create-live-test-account] createUser failed:', createError?.message);
    return NextResponse.json({ error: 'Failed to create test account' }, { status: 500 });
  }

  const userId = created.user.id;
  console.log('[owner/create-live-test-account] created user', { userId, email });

  const orgId = await ensureUserOrg(userId, email);
  if (!orgId) {
    console.error('[owner/create-live-test-account] ensureUserOrg failed for', userId);
    return NextResponse.json({ error: 'Failed to provision organization' }, { status: 500 });
  }

  const orgSub = await getOrgSubscription(orgId);
  if (orgSub.plan !== 'free') {
    console.error('[owner/create-live-test-account] expected free org sub, got', orgSub.plan);
    return NextResponse.json({ error: 'Organization subscription not initialized as free' }, { status: 500 });
  }

  console.log('[owner/create-live-test-account] test credentials', { email, password, userId, orgId });

  return NextResponse.json({
    email,
    password,
    userId,
    orgId,
    orgSubscription: {
      plan: orgSub.plan,
      status: orgSub.status,
    },
  });
}
