import { sendEmail } from '@/lib/email';
import { OWNER_EMAIL } from '@/lib/auth/owner';
import type { LeadScanContext } from '@/lib/enterprise/leadScanContext';

export interface EnterpriseLeadEmailPayload {
  id: string;
  name: string;
  email: string;
  company?: string | null;
  domain?: string | null;
  company_size?: string | null;
  security_needs?: string[] | null;
  message?: string | null;
  lead_score?: number;
}

const siteUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://cybershield-saas.vercel.app';

function adminEmail(): string {
  return process.env.ADMIN_EMAIL?.trim() || OWNER_EMAIL;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatRiskScore(context: LeadScanContext | null): string {
  if (context?.riskScore != null) return String(context.riskScore);
  if (context?.securityScore != null) return String(100 - context.securityScore);
  return 'Unknown';
}

function adminLeadEmailHtml(
  lead: EnterpriseLeadEmailPayload,
  context: LeadScanContext | null,
): string {
  const needs = Array.isArray(lead.security_needs) ? lead.security_needs.join(', ') : 'None specified';
  const domain = lead.domain ?? context?.domain ?? '—';
  const riskLabel = formatRiskScore(context);
  const insights = context?.remediationInsights ?? [];

  return `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#0f172a;padding:24px 32px;">
      <p style="color:#94a3b8;margin:0;font-size:12px;text-transform:uppercase;">CyberShield Security Intelligence</p>
      <h1 style="color:#fff;margin:8px 0 0;font-size:22px;">New Enterprise Security Lead</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#374151;font-size:16px;"><strong>${escapeHtml(lead.name)}</strong> (${escapeHtml(lead.email)})</p>
      <table style="width:100%;font-size:14px;color:#374151;margin:16px 0;">
        <tr><td style="padding:4px 0;color:#6b7280;">Company</td><td>${escapeHtml(lead.company ?? '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Domain</td><td>${escapeHtml(domain)}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Risk score</td><td><strong>${escapeHtml(riskLabel)}</strong>${context?.riskLevel ? ` (${escapeHtml(context.riskLevel)})` : ''}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Size</td><td>${escapeHtml(lead.company_size ?? '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Needs</td><td>${escapeHtml(needs)}</td></tr>
        ${context?.scanId ? `<tr><td style="padding:4px 0;color:#6b7280;">Scan ID</td><td style="font-family:monospace;font-size:12px;">${escapeHtml(context.scanId)}</td></tr>` : ''}
      </table>
      ${lead.message ? `<p style="color:#374151;font-size:14px;background:#f8fafc;padding:12px;border-radius:8px;">${escapeHtml(lead.message)}</p>` : ''}
      ${context?.summary ? `<p style="color:#374151;font-size:14px;line-height:1.6;"><strong>Scan summary:</strong> ${escapeHtml(context.summary)}</p>` : ''}
      ${insights.length ? `<ul style="color:#374151;font-size:14px;padding-left:20px;">${insights.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>` : ''}
      <a href="${siteUrl()}/dashboard/admin/sales" style="display:block;margin-top:24px;background:#2563eb;color:#fff;text-decoration:none;padding:14px;border-radius:8px;text-align:center;font-weight:600;">Open Admin Dashboard →</a>
    </div>
  </div>
</body></html>`;
}

function customerAutoResponseHtml(
  lead: EnterpriseLeadEmailPayload,
  context: LeadScanContext | null,
): string {
  const domain = lead.domain ?? context?.domain ?? 'your domain';
  const riskLabel = formatRiskScore(context);
  const insights = (context?.remediationInsights ?? []).slice(0, 5);
  const reportUrl =
    context?.reportUrl ??
    (domain !== 'your domain'
      ? `${siteUrl()}/scan-result?domain=${encodeURIComponent(domain)}`
      : `${siteUrl()}/enterprise/pricing`);

  const insightBlock =
    insights.length > 0
      ? `<h2 style="color:#0f172a;font-size:16px;margin:24px 0 12px;">Top remediation priorities</h2>
         <ul style="color:#374151;font-size:14px;line-height:1.6;padding-left:20px;margin:0;">
           ${insights.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}
         </ul>`
      : '';

  const riskBlock =
    context?.riskScore != null || context?.securityScore != null
      ? `<p style="color:#374151;font-size:14px;line-height:1.6;">Our Security Intelligence Engine analyzed <strong>${escapeHtml(domain)}</strong> and assigned a risk score of <strong>${escapeHtml(riskLabel)}</strong>${context?.riskLevel ? ` (${escapeHtml(context.riskLevel)} risk)` : ''}.</p>`
      : `<p style="color:#374151;font-size:14px;line-height:1.6;">We received your security review request for <strong>${escapeHtml(domain)}</strong>. Automated analysis will reference your latest scan data when available.</p>`;

  return `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#0f172a;padding:24px 32px;">
      <p style="color:#94a3b8;margin:0;font-size:12px;text-transform:uppercase;">Automated Security Review System</p>
      <h1 style="color:#fff;margin:8px 0 0;font-size:22px;">Your Security Review Has Been Received</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#374151;font-size:16px;">Hi ${escapeHtml(lead.name)},</p>
      <p style="color:#374151;font-size:14px;line-height:1.6;">Thank you for submitting your enterprise security review request. Responses are generated by the CyberShield Security Intelligence Engine.</p>
      ${riskBlock}
      ${insightBlock}
      <p style="color:#6b7280;font-size:13px;line-height:1.6;margin-top:20px;padding:12px;background:#f8fafc;border-radius:8px;">This is an automated security analysis. No phone call is required or scheduled.</p>
      <a href="${reportUrl}" style="display:block;margin-top:24px;background:#2563eb;color:#fff;text-decoration:none;padding:14px;border-radius:8px;text-align:center;font-weight:600;">View Full Report →</a>
      <a href="${siteUrl()}/enterprise/pricing?focus=continuousMonitoring" style="display:block;margin-top:12px;background:#0f172a;color:#fff;text-decoration:none;padding:14px;border-radius:8px;text-align:center;font-weight:600;">Upgrade to Continuous Monitoring →</a>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px;text-align:center;">CyberShield Security Intelligence Engine</p>
    </div>
  </div>
</body></html>`;
}

export async function sendEnterpriseLeadAdminEmail(
  lead: EnterpriseLeadEmailPayload,
  context: LeadScanContext | null,
): Promise<void> {
  const domain = lead.domain ?? context?.domain ?? 'Unknown';
  const riskLabel = formatRiskScore(context);

  await sendEmail({
    to: adminEmail(),
    subject: `New Enterprise Security Lead — ${domain} — Risk: ${riskLabel}`,
    html: adminLeadEmailHtml(lead, context),
  });
}

export async function sendEnterpriseLeadCustomerEmail(
  lead: EnterpriseLeadEmailPayload,
  context: LeadScanContext | null,
): Promise<void> {
  await sendEmail({
    to: lead.email,
    subject: 'Your Security Review Has Been Received — CyberShield',
    html: customerAutoResponseHtml(lead, context),
  });
}
