import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { weeklyDigestEmail } from '@/lib/emailTemplates';
import { getEffectivePlan } from '@/lib/auth/permissions';
import { getUserWithPlan } from '@/lib/billing/planService';
import { checkEmailBudget } from './emailBudget';
import { getAccountEmailPreferences, resolveAccountId } from './accountEmailPreferences';
import { logEmailAlert } from './emailAlertLog';
import { planAllowsWeeklyDigest } from './emailDecision';
import { resolveSiteUrl } from '@/lib/site/getSiteUrl';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function sendWeeklyDigests(): Promise<{ sent: number; skipped: number }> {
  const supabase = createAdminClient();
  let sent = 0;
  let skipped = 0;

  const budget = await checkEmailBudget('weekly_digest');
  if (!budget.allowed) {
    return { sent: 0, skipped: 0 };
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, org_id')
    .not('email', 'is', null);

  for (const profile of profiles ?? []) {
    const userId = profile.id;
    const orgId = profile.org_id ?? null;
    const accountId = resolveAccountId(userId, orgId);
    const prefs = await getAccountEmailPreferences(accountId);

    if (!prefs.weeklyDigestEnabled) {
      skipped++;
      continue;
    }

    const userWithPlan = await getUserWithPlan(userId, orgId);
    const plan = getEffectivePlan(userWithPlan);
    if (!planAllowsWeeklyDigest(plan)) {
      skipped++;
      continue;
    }

    const { data: lastDigest } = await supabase
      .from('email_alert_logs')
      .select('created_at')
      .eq('account_id', accountId)
      .eq('email_type', 'weekly_digest')
      .eq('status', 'sent')
      .order('created_at', { ascending: false })
      .limit(1);

    if (
      lastDigest?.[0]?.created_at &&
      Date.now() - new Date(lastDigest[0].created_at).getTime() < WEEK_MS
    ) {
      skipped++;
      continue;
    }

    const since = new Date(Date.now() - WEEK_MS).toISOString();
    const { data: digestEvents } = await supabase
      .from('alert_events')
      .select('id, severity, finding_title, website_id')
      .eq('account_id', accountId)
      .eq('digest_eligible', true)
      .gte('created_at', since)
      .in('email_status', ['queued_digest', 'pending', 'skipped']);

    const { data: websites } = await supabase
      .from('websites')
      .select('id, url, is_active')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (!websites?.length) {
      skipped++;
      continue;
    }

    const hasMeaningfulChange = (digestEvents?.length ?? 0) > 0;
    if (!hasMeaningfulChange && !prefs.allClearEnabled) {
      skipped++;
      continue;
    }

    const sslCertsRes = await supabase
      .from('ssl_certificates')
      .select('website_id, days_until_expiry')
      .in('website_id', websites.map((w) => w.id));

    const sslHealthy =
      (sslCertsRes.data?.length ?? 0) > 0 &&
      (sslCertsRes.data ?? []).every((c) => (c.days_until_expiry ?? 0) > 7);

    const websiteData = await Promise.all(
      websites.map(async (site) => {
        const { data: scan } = await supabase
          .from('scans')
          .select('id, security_score, risk_level, completed_at')
          .eq('website_id', site.id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          url: site.url,
          score: scan?.security_score ?? 0,
          riskLevel: scan?.risk_level ?? 'unknown',
          lastScanned: scan?.completed_at ?? 'Never',
          scanId: scan?.id ?? '',
        };
      }),
    );

    const siteUrl = resolveSiteUrl();
    const perAccountBudget = await checkEmailBudget('weekly_digest');
    if (!perAccountBudget.allowed) {
      skipped++;
      continue;
    }

    const subject = hasMeaningfulChange
      ? 'Your weekly CyberShield security digest'
      : 'CyberShield weekly update — all clear';
    const html = weeklyDigestEmail({
      userEmail: profile.email!,
      websites: websiteData,
      digestUrl: `${siteUrl}/app/alerts`,
      allClearMessage: !hasMeaningfulChange
        ? 'No important changes detected this week across your monitored websites.'
        : undefined,
      sslHealthyMessage: sslHealthy ? 'SSL certificates remain healthy on all monitored sites.' : undefined,
    });

    const result = await sendEmail({ to: profile.email!, subject, html });
    if (!result.success) {
      skipped++;
      await logEmailAlert({
        accountId,
        userId,
        orgId,
        recipient: profile.email!,
        emailType: 'weekly_digest',
        subject,
        status: 'failed',
        errorMessage: result.error,
      });
      continue;
    }

    await logEmailAlert({
      accountId,
      userId,
      orgId,
      recipient: profile.email!,
      emailType: 'weekly_digest',
      subject,
      status: 'sent',
      providerMessageId: result.messageId,
      websiteIds: websites.map((w) => w.id),
      alertEventIds: digestEvents?.map((e) => e.id) ?? [],
      sentAt: new Date().toISOString(),
    });

    if (digestEvents?.length) {
      await supabase
        .from('alert_events')
        .update({ email_status: 'sent', email_skip_reason: 'included_in_weekly_digest' })
        .in('id', digestEvents.map((e) => e.id));
    }

    sent++;
  }

  return { sent, skipped };
}
