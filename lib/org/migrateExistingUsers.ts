import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgSubscription, upsertOrgSubscription } from '@/lib/billing/orgSubscriptionService';
import { getUserSubscription } from '@/lib/billing/subscriptionService';

export interface MigrationResult {
  migrated: number;
  skipped: number;
  errors: string[];
}

async function backfillOrgSubscriptionFromUser(
  orgId: string,
  userId: string,
  fallbackPlan: string,
): Promise<void> {
  const supabase = createAdminClient();
  const userSub = await getUserSubscription(userId);
  const hasPaidSub = userSub.plan !== 'free' || userSub.status === 'active' || userSub.status === 'trialing';

  if (hasPaidSub) {
    await upsertOrgSubscription({
      orgId,
      plan: userSub.plan,
      status: userSub.status,
      stripeCustomerId: userSub.stripeCustomerId,
      stripeSubscriptionId: userSub.stripeSubscriptionId,
      currentPeriodEnd: userSub.currentPeriodEnd,
    });
    return;
  }

  const existing = await getOrgSubscription(orgId);
  if (existing.plan === 'free') {
    const plan = fallbackPlan === 'owner' ? 'agency' : (fallbackPlan ?? 'free');
    await upsertOrgSubscription({
      orgId,
      plan: plan as typeof userSub.plan,
      status: plan === 'free' ? 'inactive' : 'active',
    });
  }
}

/**
 * Backfill default organizations for profiles without default_org_id.
 * Creates org named "{email}'s Organization", adds user as owner,
 * sets default_org_id, backfills websites.org_id, and seeds org subscription.
 */
export async function migrateExistingUsers(): Promise<MigrationResult> {
  const supabase = createAdminClient();
  const result: MigrationResult = { migrated: 0, skipped: 0, errors: [] };

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, default_org_id, plan')
    .is('default_org_id', null);

  if (error) {
    result.errors.push(error.message);
    return result;
  }

  for (const profile of profiles ?? []) {
    try {
      const orgName = profile.email
        ? `${profile.email.split('@')[0]}'s Organization`
        : 'My Organization';

      const { data: org, error: orgErr } = await supabase
        .from('organizations')
        .insert({
          name: orgName,
          owner_id: profile.id,
          plan: profile.plan === 'owner' ? 'agency' : (profile.plan ?? 'free'),
        })
        .select('id')
        .single();

      if (orgErr || !org) {
        result.errors.push(`User ${profile.id}: ${orgErr?.message ?? 'org create failed'}`);
        continue;
      }

      const { error: memberErr } = await supabase.from('organization_members').insert({
        org_id: org.id,
        user_id: profile.id,
        role: 'owner',
      });

      if (memberErr) {
        result.errors.push(`User ${profile.id}: ${memberErr.message}`);
        continue;
      }

      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ default_org_id: org.id })
        .eq('id', profile.id);

      if (profileErr) {
        result.errors.push(`User ${profile.id}: ${profileErr.message}`);
        continue;
      }

      await supabase
        .from('websites')
        .update({ org_id: org.id })
        .eq('user_id', profile.id)
        .is('org_id', null);

      await backfillOrgSubscriptionFromUser(org.id, profile.id, profile.plan ?? 'free');

      result.migrated++;
    } catch (err) {
      result.errors.push(`User ${profile.id}: ${String(err)}`);
    }
  }

  result.skipped = (profiles?.length ?? 0) - result.migrated - result.errors.length;
  return result;
}

/** Ensure a single user has a default org (idempotent). */
export async function ensureUserOrg(userId: string, email: string | null): Promise<string | null> {
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('default_org_id, plan')
    .eq('id', userId)
    .single();

  if (profile?.default_org_id) return profile.default_org_id;

  const orgName = email ? `${email.split('@')[0]}'s Organization` : 'My Organization';

  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .insert({
      name: orgName,
      owner_id: userId,
      plan: profile?.plan === 'owner' ? 'agency' : (profile?.plan ?? 'free'),
    })
    .select('id')
    .single();

  if (orgErr || !org) return null;

  await supabase.from('organization_members').insert({
    org_id: org.id,
    user_id: userId,
    role: 'owner',
  });

  await supabase.from('profiles').update({ default_org_id: org.id }).eq('id', userId);

  await supabase
    .from('websites')
    .update({ org_id: org.id })
    .eq('user_id', userId)
    .is('org_id', null);

  await backfillOrgSubscriptionFromUser(org.id, userId, profile?.plan ?? 'free');

  return org.id;
}
