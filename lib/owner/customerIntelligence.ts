import { createAdminClient } from '@/lib/supabase/admin';
import { isInternalCustomerProfile } from './internalAccountFilters';

export interface CustomerIntelligenceSummary {
  topIndustries: { name: string; count: number }[];
  commonFindings: { finding: string; count: number }[];
  avgRiskScore: number;
  churnSignals: number;
  conversionSignals: number;
  hotProspects: number;
  churnDrivers: string[];
  conversionDrivers: string[];
}

export async function getCustomerIntelligence(): Promise<CustomerIntelligenceSummary> {
  const admin = createAdminClient();

  const [scansRes, profilesRes, crmRes, hotProspectsRes] = await Promise.all([
    admin.from('scans').select('score, issues').order('created_at', { ascending: false }).limit(200),
    admin
      .from('profiles')
      .select('churn_risk_score, subscription_status, plan, updated_at, email, is_qa_account')
      .not('churn_risk_score', 'is', null),
    admin.from('owner_crm_leads').select('industry').not('industry', 'is', null),
    admin
      .from('owner_prospects')
      .select('id', { count: 'exact', head: true })
      .eq('lead_score', 'HOT'),
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

  const customerProfiles = (profilesRes.data ?? []).filter(
    (p) =>
      !isInternalCustomerProfile({
        email: (p as { email?: string }).email ?? '',
        is_qa_account: (p as { is_qa_account?: boolean }).is_qa_account ?? null,
        plan: (p.plan as string) ?? null,
      }),
  );

  const churnSignals = customerProfiles.filter(
    (p) => (p.churn_risk_score ?? 0) > 70,
  ).length;
  const conversionSignals = customerProfiles.filter(
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

  const churnDrivers: string[] = [];
  const atRisk = customerProfiles.filter((p) => (p.churn_risk_score ?? 0) > 70);
  if (atRisk.length > 0) {
    churnDrivers.push(`${atRisk.length} accounts with churn risk score > 70`);
  }
  const inactive = customerProfiles.filter((p) => {
    const ts = (p as { updated_at?: string }).updated_at;
    if (!ts) return false;
    const days = (Date.now() - new Date(ts).getTime()) / 86400000;
    return days > 30 && p.subscription_status === 'active';
  });
  if (inactive.length > 0) {
    churnDrivers.push(`${inactive.length} active subscribers inactive 30+ days`);
  }
  const freeStuck = customerProfiles.filter(
    (p) => p.plan === 'free' && p.subscription_status !== 'active',
  );
  if (freeStuck.length > 5) {
    churnDrivers.push(`${freeStuck.length} free users not converting — onboarding friction`);
  }

  const conversionDrivers: string[] = [];
  const paid = customerProfiles.filter(
    (p) => p.subscription_status === 'active' || p.subscription_status === 'trialing',
  );
  if (paid.length > 0) {
    conversionDrivers.push(`${paid.length} active/trialing subscribers — replicate their onboarding path`);
  }
  if (topIndustries.length > 0) {
    conversionDrivers.push(`Top converting vertical: ${topIndustries[0].name} (${topIndustries[0].count} leads)`);
  }
  if (commonFindings.length > 0) {
    conversionDrivers.push(
      `Security pain point hook: "${commonFindings[0].finding.slice(0, 60)}"`,
    );
  }

  return {
    topIndustries,
    commonFindings,
    avgRiskScore: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0,
    churnSignals,
    conversionSignals,
    hotProspects: hotProspectsRes.count ?? 0,
    churnDrivers,
    conversionDrivers,
  };
}
