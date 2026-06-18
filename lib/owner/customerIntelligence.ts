import { createAdminClient } from '@/lib/supabase/admin';

export interface CustomerIntelligenceSummary {
  topIndustries: { name: string; count: number }[];
  commonFindings: { finding: string; count: number }[];
  avgRiskScore: number;
  churnSignals: number;
  conversionSignals: number;
}

export async function getCustomerIntelligence(): Promise<CustomerIntelligenceSummary> {
  const admin = createAdminClient();

  const [scansRes, profilesRes, crmRes] = await Promise.all([
    admin.from('scans').select('score, issues').order('created_at', { ascending: false }).limit(200),
    admin
      .from('profiles')
      .select('churn_risk_score, subscription_status')
      .not('churn_risk_score', 'is', null),
    admin.from('owner_crm_leads').select('industry').not('industry', 'is', null),
  ]);

  const industryCounts = new Map<string, number>();
  for (const row of crmRes.data ?? []) {
    const ind = (row.industry as string)?.trim();
    if (!ind) continue;
    industryCounts.set(ind, (industryCounts.get(ind) ?? 0) + 1);
  }

  const findingCounts = new Map<string, number>();
  let scoreSum = 0;
  let scoreCount = 0;
  for (const scan of scansRes.data ?? []) {
    if (typeof scan.score === 'number') {
      scoreSum += scan.score;
      scoreCount++;
    }
    const issues = (scan.issues as string[] | null) ?? [];
    for (const issue of issues.slice(0, 3)) {
      const key = issue.slice(0, 80);
      findingCounts.set(key, (findingCounts.get(key) ?? 0) + 1);
    }
  }

  const churnSignals = (profilesRes.data ?? []).filter(
    (p) => (p.churn_risk_score ?? 0) > 70,
  ).length;
  const conversionSignals = (profilesRes.data ?? []).filter(
    (p) => p.subscription_status === 'active' || p.subscription_status === 'trialing',
  ).length;

  const topIndustries = [...industryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  const commonFindings = [...findingCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([finding, count]) => ({ finding, count }));

  return {
    topIndustries,
    commonFindings,
    avgRiskScore: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0,
    churnSignals,
    conversionSignals,
  };
}
