/**
 * Apply a safe autopilot recommendation to production autopilot_config.
 * Usage: npx tsx scripts/apply-autopilot-recommendation.ts improve_onboarding
 */
import { applyAutopilotConfigByKey } from '../lib/brain/applyAutopilotConfig';
import { createAdminClient } from '../lib/supabase/admin';

async function resolveOwnerUserId(): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  const owner = data?.users?.find(
    (u) => u.email?.toLowerCase() === 'avanbailey@gmail.com',
  );
  return owner?.id ?? null;
}

async function main() {
  const recommendationKey = process.argv[2] ?? 'improve_onboarding';
  const userId = await resolveOwnerUserId();

  const result = await applyAutopilotConfigByKey(
    recommendationKey,
    userId,
    'manual_apply',
    null,
  );

  if (!result.ok) {
    console.error('Apply failed:', result.error);
    process.exit(1);
  }

  console.log('Applied autopilot config:', result.applied);
  console.log('Changed keys:', result.changedKeys);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
