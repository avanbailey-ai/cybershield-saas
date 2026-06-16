/**
 * One-off: persist org intelligence (rolling risk, posture, anomalies, narratives).
 * Usage: npx tsx scripts/run-org-intelligence-backfill.ts
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in environment.
 */

import { backfillOrgIntelligenceForAllOrgs } from '../lib/enterprise/backfillOrgIntelligence';

async function main() {
  const result = await backfillOrgIntelligenceForAllOrgs();
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
