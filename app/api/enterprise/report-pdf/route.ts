import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getPublicReportByToken } from '@/lib/share/reportShare';
import { getUserOrgRole } from '@/lib/auth/rbac';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildExecutiveSummaryHtml(report: {
  domain: string;
  securityScore: number;
  summary: string;
  findingPreviews: Array<{ title: string; severity: string }>;
  executiveSummary: string | null;
  shareToken: string;
}): string {
  const generated = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const vulnRows = report.findingPreviews
    .map(
      (v) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(v.title)}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-transform:capitalize;">${escapeHtml(v.severity)}</td></tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Executive Summary — ${escapeHtml(report.domain)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; color: #1f2937; }
    h1 { color: #0f172a; border-bottom: 2px solid #2563eb; padding-bottom: 12px; }
    .score { font-size: 48px; font-weight: 800; color: ${report.securityScore >= 70 ? '#16a34a' : report.securityScore >= 40 ? '#ca8a04' : '#dc2626'}; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { text-align: left; padding: 8px; background: #f8fafc; border-bottom: 2px solid #e5e7eb; }
    .footer { margin-top: 40px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <h1>Executive Security Summary</h1>
  <p><strong>Domain:</strong> ${escapeHtml(report.domain)}</p>
  <p><strong>Generated:</strong> ${generated}</p>
  <p class="score">${report.securityScore}<span style="font-size:20px;color:#94a3b8;">/100</span></p>
  <h2>Overview</h2>
  <p>${escapeHtml(report.executiveSummary ?? report.summary.slice(0, 500))}</p>
  <h2>Top Findings</h2>
  <table>
    <thead><tr><th>Issue</th><th>Severity</th></tr></thead>
    <tbody>${vulnRows || '<tr><td colspan="2">No critical findings in preview.</td></tr>'}</tbody>
  </table>
  <h2>Recommendations</h2>
  <ul>
    <li>Enable continuous monitoring to detect configuration drift</li>
    <li>Implement security headers (CSP, HSTS, X-Frame-Options)</li>
    <li>Schedule a security review for enterprise-grade remediation</li>
  </ul>
  <div class="footer">
    <p>Prepared by CyberShield — Confidential</p>
    <p>Share link: /scan-result/${escapeHtml(report.shareToken)}</p>
  </div>
</body>
</html>`;
}

/**
 * GET /api/enterprise/report-pdf?token=... — downloadable executive summary (HTML).
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'token query parameter required' }, { status: 400 });
  }

  const report = await getPublicReportByToken(token);

  if (!report) {
    return NextResponse.json({ error: 'Report not found or not shared' }, { status: 404 });
  }

  const html = buildExecutiveSummaryHtml(report);
  const filename = `CyberShield-Executive-Summary-${report.domain.replace(/[^a-z0-9.-]/gi, '_')}.html`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

/**
 * POST — generate share link for a scan report (uses existing share_token pattern).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { reportId?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.reportId) {
    return NextResponse.json({ error: 'reportId required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: report } = await admin
    .from('scan_reports')
    .select('id, user_id, org_id, share_token, is_public, domain')
    .eq('id', body.reportId)
    .single();

  if (!report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  const ownsReport = report.user_id === user.id;
  let orgMember = false;
  if (report.org_id) {
    const role = await getUserOrgRole(user.id, report.org_id);
    orgMember = role !== null;
  }

  if (!ownsReport && !orgMember) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let shareToken = report.share_token;

  if (!shareToken || !report.is_public) {
    const { generateShareToken } = await import('@/lib/share/token');
    shareToken = generateShareToken();
    await admin
      .from('scan_reports')
      .update({
        share_token: shareToken,
        is_public: true,
        share_approved_at: new Date().toISOString(),
      })
      .eq('id', body.reportId);
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '';

  return NextResponse.json({
    shareUrl: `${baseUrl}/scan-result/${shareToken}`,
    downloadUrl: `${baseUrl}/api/enterprise/report-pdf?token=${shareToken}`,
    domain: report.domain,
  });
}
