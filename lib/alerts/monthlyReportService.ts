import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { getEffectivePlan } from '@/lib/auth/permissions';
import { getUserWithPlan } from '@/lib/billing/planService';
import { checkEmailBudget } from './emailBudget';
import { getAccountEmailPreferences, resolveAccountId } from './accountEmailPreferences';
import { logEmailAlert } from './emailAlertLog';
import { planAllowsMonthlyReport } from './emailDecision';
import { resolveSiteUrl } from '@/lib/site/getSiteUrl';

export async function sendMonthlyReports(): Promise<{ sent: number; skipped: number }> {
  const supabase = createAdminClient();
  let sent = 0;
  let skipped = 0;

  const budget = await checkEmailBudget('monthly_report');
  if (!budget.allowed) {
    return { sent: 0, skipped: 0 };
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const monthKey = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, '0')}`;

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, org_id')
    .not('email', 'is', null);

  for (const profile of profiles ?? []) {
    const userId = profile.id;
    const orgId = profile.org_id ?? null;
    const accountId = resolveAccountId(userId, orgId);
    const prefs = await getAccountEmailPreferences(accountId);

    if (!prefs.monthlyReportEnabled) {
      skipped++;
      continue;
    }

    const userWithPlan = await getUserWithPlan(userId, orgId);
    if (!planAllowsMonthlyReport(getEffectivePlan(userWithPlan))) {
      skipped++;
      continue;
    }

    const { count: alreadySent } = await supabase
      .from('email_alert_logs')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .eq('email_type', 'monthly_report')
      .eq('status', 'sent')
      .eq('budget_month', monthKey);

    if ((alreadySent ?? 0) > 0) {
      skipped++;
      continue;
    }

    const { data: websites } = await supabase
      .from('websites')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (!websites?.length) {
      skipped++;
      continue;
    }

    const since = monthStart.toISOString();
    const { count: checksCompleted } = await supabase
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('completed_at', since);

    const { count: openCritical } = await supabase
      .from('alert_events')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .in('severity', ['critical', 'high'])
      .eq('is_resolved', false)
      .gte('created_at', since);

    const perAccountBudget = await checkEmailBudget('monthly_report');
    if (!perAccountBudget.allowed) {
      skipped++;
      continue;
    }

    const siteUrl = resolveSiteUrl();
    const subject = 'Your monthly CyberShield security report';
    const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;padding:24px;color:#111;">
      <h2>Monthly security report</h2>
      <p>CyberShield monitored <strong>${websites.length}</strong> website${websites.length === 1 ? '' : 's'} this month.</p>
      <ul>
        <li>Checks completed: ${checksCompleted ?? 0}</li>
        <li>Open critical/high issues: ${openCritical ?? 0}</li>
      </ul>
      <p><a href="${siteUrl}/dashboard">View your dashboard</a> for full details and recommended next steps.</p>
      <p style="color:#666;font-size:12px;">You receive this monthly summary because monitoring is enabled on your account.</p>
    </body></html>`;

    const result = await sendEmail({ to: profile.email!, subject, html });
    if (!result.success) {
      skipped++;
      continue;
    }

    await logEmailAlert({
      accountId,
      userId,
      orgId,
      recipient: profile.email!,
      emailType: 'monthly_report',
      subject,
      status: 'sent',
      providerMessageId: result.messageId,
      websiteIds: websites.map((w) => w.id),
      budgetMonth: monthKey,
      sentAt: new Date().toISOString(),
    });

    sent++;
  }

  return { sent, skipped };
}
