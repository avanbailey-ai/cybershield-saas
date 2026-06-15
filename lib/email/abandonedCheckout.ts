import { sendEmail } from '@/lib/email';
import { createAdminClient } from '@/lib/supabase/admin';

const siteUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://cybershield-saas.vercel.app';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function recoveryEmailHtml(plan: string): string {
  return `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#0f172a;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:22px;">Your CyberShield protection is waiting</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#374151;font-size:16px;line-height:1.6;">You started upgrading to the <strong>${escapeHtml(plan)}</strong> plan but didn't finish checkout. Your website security monitoring is just one click away.</p>
      <p style="color:#374151;font-size:14px;">Complete your upgrade to unlock daily scans, email alerts, and full security reports.</p>
      <a href="${siteUrl()}/pricing" style="display:block;margin-top:24px;background:#2563eb;color:#fff;text-decoration:none;padding:14px;border-radius:8px;text-align:center;font-weight:600;">Complete Your Upgrade →</a>
    </div>
  </div>
</body></html>`;
}

export async function processAbandonedCheckouts(): Promise<{ processed: number; sent: number }> {
  const supabase = createAdminClient();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: checkouts } = await supabase
    .from('abandoned_checkouts')
    .select('id, user_id, email, plan, session_id')
    .eq('status', 'started')
    .eq('recovery_email_sent', false)
    .lt('created_at', oneHourAgo)
    .limit(50);

  if (!checkouts || checkouts.length === 0) {
    return { processed: 0, sent: 0 };
  }

  let sent = 0;

  for (const checkout of checkouts) {
    const result = await sendEmail({
      to: checkout.email,
      subject: 'Your CyberShield protection is waiting',
      html: recoveryEmailHtml(checkout.plan),
    });

    if (result.success) {
      await supabase
        .from('abandoned_checkouts')
        .update({ recovery_email_sent: true, status: 'recovered' })
        .eq('id', checkout.id);

      await supabase.from('email_events').insert({
        user_id: checkout.user_id,
        email: checkout.email,
        event_type: 'sent',
        template: 'abandoned_checkout_recovery',
        metadata: { plan: checkout.plan, session_id: checkout.session_id },
      });

      sent++;
    }
  }

  return { processed: checkouts.length, sent };
}
