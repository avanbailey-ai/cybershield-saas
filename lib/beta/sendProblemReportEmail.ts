import { sendEmail } from '@/lib/email';
import { OWNER_EMAIL } from '@/lib/auth/owner';
import type { ProblemSeverity, ProblemType } from '@/lib/beta/problemReports';

interface ProblemReportEmailInput {
  severity: ProblemSeverity;
  problemType: ProblemType;
  message: string;
  pageUrl: string;
  contactEmail?: string | null;
  userEmail?: string | null;
  plan?: string | null;
  debugContext: Record<string, unknown>;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendProblemReportEmail(
  input: ProblemReportEmailInput,
): Promise<void> {
  const subject = `CyberShield Beta Problem Report — ${input.severity} — ${input.problemType}`;
  const contact = input.contactEmail || input.userEmail || '(not provided)';
  const contextSummary = escapeHtml(JSON.stringify(input.debugContext, null, 2));

  const html = `
    <h2>Beta Problem Report</h2>
    <p><strong>Severity:</strong> ${escapeHtml(input.severity)}</p>
    <p><strong>Type:</strong> ${escapeHtml(input.problemType)}</p>
    <p><strong>Plan:</strong> ${escapeHtml(input.plan ?? 'unknown')}</p>
    <p><strong>Contact:</strong> ${escapeHtml(contact)}</p>
    <p><strong>Page:</strong> <a href="${escapeHtml(input.pageUrl)}">${escapeHtml(input.pageUrl)}</a></p>
    <h3>Message</h3>
    <pre style="white-space:pre-wrap;font-family:sans-serif;">${escapeHtml(input.message)}</pre>
    <h3>Debug context</h3>
    <pre style="white-space:pre-wrap;font-family:monospace;font-size:12px;">${contextSummary}</pre>
  `;

  const result = await sendEmail({
    to: OWNER_EMAIL,
    subject,
    html,
  });

  if (!result.success) {
    console.warn('[beta/report-problem] Email notification skipped:', result.error);
  }
}
