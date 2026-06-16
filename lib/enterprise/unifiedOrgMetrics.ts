import 'server-only';

import { getOrgDashboardSummary, type OrgDashboardSummary } from './orgDashboardSummary';

/** Single SSOT for org-scoped dashboard metrics (main + enterprise + API). */
export async function getUnifiedOrgMetrics(orgId: string): Promise<OrgDashboardSummary> {
  return getOrgDashboardSummary(orgId);
}

export type { OrgDashboardSummary };
