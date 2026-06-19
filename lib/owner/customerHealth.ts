import { createAdminClient } from '@/lib/supabase/admin';
import { getPlanDisplayAmounts } from '@/lib/billing/stripeDisplayPrices';
import { PLAN_LIMITS, type Plan } from '@/lib/billing/plans';
import { formatInactivityDays, isInternalCustomerProfile } from './internalAccountFilters';

export type CustomerHealthStatus = 'Healthy' | 'At Risk' | 'Critical';

export interface CustomerHealthFactor {
  ok: boolean;
  label: string;
}

export interface CustomerHealthRecord {
  userId: string;
  email: string;
  plan: string;
  mrr: number;
  score: number;
  status: CustomerHealthStatus;
  reasons: CustomerHealthFactor[];
  recommendedActions: string[];
  lastActivityAt: string | null;
  websiteCount: number;
}

export interface CustomerHealthSummary {
  generatedAt: string;
  customers: CustomerHealthRecord[];
  healthy: number;
  atRisk: number;
  critical: number;
  inactive: number;
}

const MS_DAY = 86400000;

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / MS_DAY);
}

function statusFromScore(score: number): CustomerHealthStatus {
  if (score >= 70) return 'Healthy';
  if (score >= 40) return 'At Risk';
  return 'Critical';
}

function planMrr(plan: string, amounts: Partial<Record<string, number>>): number {
  if (plan === 'free' || plan === 'owner') return 0;
  return amounts[plan] ?? 0;
}

export async function getCustomerHealth(): Promise<CustomerHealthSummary> {
  const admin = createAdminClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * MS_DAY).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * MS_DAY).toISOString();

  const [profilesRes, websitesRes, scansRes, subsRes, sslRes, reportsRes, displayAmounts] =
    await Promise.all([
      admin
        .from('profiles')
        .select('id, email, plan, subscription_status, churn_risk_score, last_active_at, updated_at, is_qa_account')
        .neq('plan', 'owner')
        .in('subscription_status', ['active', 'trialing', 'past_due']),
      admin.from('websites').select('id, user_id, is_active, url'),
      admin
        .from('scans')
        .select('user_id, created_at')
        .gte('created_at', thirtyDaysAgo),
      admin.from('subscriptions').select('user_id, status'),
      admin
        .from('ssl_certificates')
        .select('website_id, days_until_expiry, checked_at')
        .lte('days_until_expiry', 30)
        .order('checked_at', { ascending: false }),
      admin
        .from('ai_report_cache')
        .select('website_id, created_at, websites(user_id)')
        .gte('created_at', thirtyDaysAgo),
      getPlanDisplayAmounts(),
    ]);

  const profiles = profilesRes.data ?? [];
  const websites = websitesRes.data ?? [];
  const scans = scansRes.data ?? [];
  const subs = new Map((subsRes.data ?? []).map((s) => [s.user_id as string, s.status as string]));
  const reportsByUser = new Map<string, number>();
  for (const r of reportsRes.data ?? []) {
    const websites = r.websites as { user_id?: string } | { user_id?: string }[] | null;
    const uid = Array.isArray(websites) ? websites[0]?.user_id : websites?.user_id;
    if (!uid) continue;
    reportsByUser.set(uid, (reportsByUser.get(uid) ?? 0) + 1);
  }

  const websitesByUser = new Map<string, { count: number; active: number; ids: string[] }>();
  for (const w of websites) {
    const uid = w.user_id as string;
    const cur = websitesByUser.get(uid) ?? { count: 0, active: 0, ids: [] };
    cur.count++;
    if (w.is_active) cur.active++;
    cur.ids.push(w.id as string);
    websitesByUser.set(uid, cur);
  }

  const scansByUser = new Map<string, { recent: number; lastAt: string | null }>();
  for (const s of scans) {
    const uid = s.user_id as string;
    const cur = scansByUser.get(uid) ?? { recent: 0, lastAt: null };
    cur.recent++;
    const at = s.created_at as string;
    if (!cur.lastAt || at > cur.lastAt) cur.lastAt = at;
    scansByUser.set(uid, cur);
  }

  const sslByWebsite = new Map<string, number>();
  for (const c of sslRes.data ?? []) {
    const wid = c.website_id as string;
    if (!sslByWebsite.has(wid)) {
      sslByWebsite.set(wid, c.days_until_expiry as number);
    }
  }

  const customers: CustomerHealthRecord[] = [];

  for (const p of profiles) {
    const email = (p.email as string) ?? '';
    if (
      isInternalCustomerProfile({
        email,
        is_qa_account: (p as { is_qa_account?: boolean }).is_qa_account ?? null,
        plan: (p.plan as string) ?? null,
      })
    )
      continue;

    const userId = p.id as string;
    const plan = (p.plan as string) ?? 'free';
    if (plan === 'free' && p.subscription_status !== 'trialing') continue;

    const siteInfo = websitesByUser.get(userId) ?? { count: 0, active: 0, ids: [] };
    const scanInfo = scansByUser.get(userId) ?? { recent: 0, lastAt: null };
    const lastActivity = (p.last_active_at as string) ?? (p.updated_at as string) ?? scanInfo.lastAt;
    const loginDays = daysSince(lastActivity);
    const scanDays = daysSince(scanInfo.lastAt);
    const subStatus = subs.get(userId) ?? (p.subscription_status as string);
    const churnRisk = (p.churn_risk_score as number) ?? 0;

    let minSslDays = 999;
    for (const wid of siteInfo.ids) {
      const d = sslByWebsite.get(wid);
      if (d !== undefined && d < minSslDays) minSslDays = d;
    }

    const reasons: CustomerHealthFactor[] = [];
    const actions: string[] = [];
    let score = 50;

    if (loginDays !== null && loginDays <= 7) {
      score += 15;
      reasons.push({ ok: true, label: 'Logged in within 7 days' });
    } else if (loginDays !== null && loginDays <= 30) {
      score += 5;
      reasons.push({ ok: true, label: 'Active within 30 days' });
    } else {
      const inactiveDays = loginDays ?? 999;
      score -= inactiveDays > 60 ? 25 : 15;
      reasons.push({
        ok: false,
        label: formatInactivityDays(inactiveDays),
      });
      if (inactiveDays > 30) actions.push('Send re-engagement email');
    }

    if (scanDays !== null && scanDays <= 7) {
      score += 15;
      reasons.push({ ok: true, label: 'Recent scan activity' });
    } else if (scanDays !== null && scanDays <= 30) {
      score += 5;
      reasons.push({ ok: true, label: 'Scanned within 30 days' });
    } else if (siteInfo.active > 0 && scanDays === null) {
      score += 5;
      reasons.push({ ok: true, label: 'Active monitoring (no manual scans needed)' });
    } else {
      score -= scanDays === null || scanDays > 30 ? 12 : 0;
      if (scanDays === null || scanDays > 30) {
        reasons.push({ ok: false, label: 'No scans in 30+ days' });
        if (siteInfo.active === 0) actions.push('Prompt fresh security scan');
      }
    }

    if (siteInfo.active > 0) {
      score += 10;
      reasons.push({ ok: true, label: 'Monitoring enabled' });
    } else if (siteInfo.count > 0) {
      score -= 5;
      reasons.push({ ok: false, label: 'Websites not actively monitored' });
      actions.push('Enable continuous monitoring');
    } else {
      score -= 10;
      reasons.push({ ok: false, label: 'No websites added' });
      actions.push('Help customer add first website');
    }

    if (siteInfo.count > 0) {
      score += 5;
      const limit = PLAN_LIMITS[plan as Plan]?.websites ?? 1;
      if (limit !== Infinity && siteInfo.count >= limit * 0.8) {
        reasons.push({ ok: true, label: 'High website utilization' });
      }
    }

    if ((reportsByUser.get(userId) ?? 0) > 0) {
      score += 8;
      reasons.push({ ok: true, label: 'Engaged with security reports' });
    }

    if (minSslDays <= 7) {
      score -= 20;
      reasons.push({ ok: false, label: `SSL expires in ${minSslDays} days` });
      actions.push('Alert customer about SSL expiry');
    } else if (minSslDays <= 30) {
      score -= 10;
      reasons.push({ ok: false, label: `SSL expiring within ${minSslDays} days` });
    } else if (siteInfo.count > 0) {
      reasons.push({ ok: true, label: 'SSL certificates healthy' });
    }

    if (subStatus === 'past_due') {
      score -= 30;
      reasons.push({ ok: false, label: 'Payment past due' });
      actions.push('Contact customer about billing');
    } else if (subStatus === 'active' || subStatus === 'trialing') {
      reasons.push({ ok: true, label: 'Subscription in good standing' });
    }

    score += Math.round((100 - churnRisk) * 0.15);
    if (churnRisk > 70) {
      reasons.push({ ok: false, label: 'Elevated churn risk score' });
      actions.push('Schedule retention outreach');
    } else if (churnRisk <= 40) {
      reasons.push({ ok: true, label: 'Low churn risk' });
    }

    const finalScore = Math.max(0, Math.min(100, Math.round(score)));
    const status = statusFromScore(finalScore);

    if (status !== 'Healthy' && actions.length === 0) {
      actions.push('Review account in customer success center');
    }

    customers.push({
      userId,
      email,
      plan,
      mrr: planMrr(plan, displayAmounts),
      score: finalScore,
      status,
      reasons: reasons.slice(0, 8),
      recommendedActions: [...new Set(actions)].slice(0, 4),
      lastActivityAt: lastActivity,
      websiteCount: siteInfo.count,
    });
  }

  customers.sort((a, b) => a.score - b.score);

  const inactive = customers.filter((c) => {
    const d = daysSince(c.lastActivityAt);
    return d !== null && d > 30;
  }).length;

  return {
    generatedAt: new Date().toISOString(),
    customers,
    healthy: customers.filter((c) => c.status === 'Healthy').length,
    atRisk: customers.filter((c) => c.status === 'At Risk').length,
    critical: customers.filter((c) => c.status === 'Critical').length,
    inactive,
  };
}
