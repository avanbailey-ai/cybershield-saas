import { sendEmail } from '@/lib/email';
import { OWNER_EMAIL } from '@/lib/auth/owner';

export interface EnterpriseLeadNotification {
  id: string;
  name: string;
  email: string;
  company?: string | null;
  domain?: string | null;
  company_size?: string | null;
  security_needs?: string[] | null;
  message?: string | null;
  lead_score: number;
  status: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function suggestedAction(score: number, status: string): string {
  if (status === 'qualified' || score >= 70) {
    return 'High-intent lead — schedule a security demo within 24 hours.';
  }
  if (score >= 50) {
    return 'Warm lead — send case study and follow up in 2 days.';
  }
  return 'New inbound lead — review and send intro email.';
}

const siteUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://cybershield-saas.vercel.app';

function adminLeadEmailHtml(lead: EnterpriseLeadNotification): string {
  const needs = Array.isArray(lead.security_needs) ? lead.security_needs.join(', ') : 'None specified';
  const action = suggestedAction(lead.lead_score, lead.status);

  return `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#0f172a;padding:24px 32px;">
      <p style="color:#94a3b8;margin:0;font-size:12px;text-transform:uppercase;">CyberShield Sales</p>
      <h1 style="color:#fff;margin:8px 0 0;font-size:22px;">New Enterprise Lead</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#374151;font-size:16px;"><strong>${escapeHtml(lead.name)}</strong> (${escapeHtml(lead.email)})</p>
      <table style="width:100%;font-size:14px;color:#374151;margin:16px 0;">
        <tr><td style="padding:4px 0;color:#6b7280;">Company</td><td>${escapeHtml(lead.company ?? '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Domain</td><td>${escapeHtml(lead.domain ?? '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Size</td><td>${escapeHtml(lead.company_size ?? '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Score</td><td><strong>${lead.lead_score}/100</strong> (${escapeHtml(lead.status)})</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Needs</td><td>${escapeHtml(needs)}</td></tr>
      </table>
      ${lead.message ? `<p style="color:#374151;font-size:14px;background:#f8fafc;padding:12px;border-radius:8px;">${escapeHtml(lead.message)}</p>` : ''}
      <p style="color:#2563eb;font-size:14px;font-weight:600;margin-top:20px;">Suggested action: ${escapeHtml(action)}</p>
      <a href="${siteUrl()}/dashboard/admin/sales" style="display:block;margin-top:24px;background:#2563eb;color:#fff;text-decoration:none;padding:14px;border-radius:8px;text-align:center;font-weight:600;">Open Sales Dashboard →</a>
    </div>
  </div>
</body></html>`;
}

/** Non-blocking admin notification for new enterprise leads. */
export function notifyAdminNewLead(lead: EnterpriseLeadNotification): void {
  void sendEmail({
    to: OWNER_EMAIL,
    subject: `[CyberShield Sales] New lead: ${lead.name} (score ${lead.lead_score})`,
    html: adminLeadEmailHtml(lead),
  }).catch((err) => {
    console.error('[sales/notify] admin notification failed:', err);
  });
}
