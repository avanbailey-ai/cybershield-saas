export function securityAlertEmail(data: {
  userEmail: string;
  websiteUrl: string;
  score: number;
  riskLevel: string;
  issues: string[];
  reportUrl: string;
}): string {
  const levelColor = data.riskLevel === 'critical' ? '#dc2626' :
                     data.riskLevel === 'high' ? '#ea580c' :
                     data.riskLevel === 'medium' ? '#ca8a04' : '#16a34a';

  const levelLabel = data.riskLevel.charAt(0).toUpperCase() + data.riskLevel.slice(1);

  const issuesList = data.issues.slice(0, 3).map(issue =>
    `<li style="margin-bottom:8px;color:#374151;">${escapeHtml(issue)}</li>`
  ).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">

    <!-- Header -->
    <div style="background:#0f172a;padding:24px 32px;">
      <p style="color:#94a3b8;margin:0;font-size:12px;letter-spacing:1px;text-transform:uppercase;">CyberShield Security Alert</p>
      <h1 style="color:#ffffff;margin:8px 0 0;font-size:22px;font-weight:700;">Action Required</h1>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 24px;">
        We detected security issues on <strong>${escapeHtml(data.websiteUrl)}</strong> that need your attention.
      </p>

      <!-- Score badge -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px;text-align:center;">
        <p style="margin:0 0 4px;color:#64748b;font-size:13px;">Security Score</p>
        <p style="margin:0;font-size:48px;font-weight:800;color:${levelColor};">${data.score}<span style="font-size:20px;color:#94a3b8;">/100</span></p>
        <span style="display:inline-block;background:${levelColor};color:#fff;font-size:12px;font-weight:700;padding:4px 12px;border-radius:99px;margin-top:8px;text-transform:uppercase;">${levelLabel} Risk</span>
      </div>

      <!-- What's wrong -->
      ${data.issues.length > 0 ? `
      <h2 style="color:#0f172a;font-size:16px;margin:0 0 12px;">What we found:</h2>
      <ul style="margin:0 0 24px;padding-left:20px;color:#374151;">
        ${issuesList}
      </ul>
      ` : ''}

      <!-- Why it matters -->
      <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:16px;border-radius:0 8px 8px 0;margin-bottom:24px;">
        <p style="margin:0;color:#92400e;font-size:14px;line-height:1.5;">
          <strong>Why this matters:</strong> Security vulnerabilities can expose your website to hackers, damage your SEO rankings, and erode customer trust. These issues are typically quick to fix with your web developer.
        </p>
      </div>

      <!-- CTA -->
      <a href="${data.reportUrl}" style="display:block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;text-align:center;font-weight:600;font-size:15px;">
        View Full Security Report &rarr;
      </a>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
        You&apos;re receiving this because you monitor <strong>${escapeHtml(data.websiteUrl)}</strong> on CyberShield.<br>
        <a href="${data.reportUrl}" style="color:#2563eb;">View dashboard</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function weeklyDigestEmail(data: {
  userEmail: string;
  websites: Array<{
    url: string;
    score: number;
    riskLevel: string;
    lastScanned: string;
    scanId: string;
  }>;
  digestUrl: string;
}): string {
  const overallAvg = data.websites.length > 0
    ? Math.round(data.websites.reduce((sum, s) => sum + s.score, 0) / data.websites.length)
    : 0;

  const avgColor = overallAvg >= 80 ? '#16a34a' : overallAvg >= 60 ? '#ca8a04' : '#dc2626';

  const siteRows = data.websites.map(site => {
    const scoreColor = site.score >= 80 ? '#16a34a' : site.score >= 60 ? '#ca8a04' : '#dc2626';
    const riskLabel = site.riskLevel.charAt(0).toUpperCase() + site.riskLevel.slice(1);
    const lastScanned = site.lastScanned && site.lastScanned !== 'Never'
      ? new Date(site.lastScanned).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : 'Never';

    return `<tr>
      <td style="padding:12px 16px;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb;word-break:break-all;">${escapeHtml(site.url)}</td>
      <td style="padding:12px 16px;text-align:center;border-bottom:1px solid #e5e7eb;">
        <span style="font-size:15px;font-weight:700;color:${scoreColor};">${site.score}</span>
        <span style="font-size:11px;color:#9ca3af;">/100</span>
      </td>
      <td style="padding:12px 16px;text-align:center;border-bottom:1px solid #e5e7eb;">
        <span style="background:${scoreColor}22;color:${scoreColor};font-size:11px;font-weight:600;padding:3px 10px;border-radius:99px;">${riskLabel}</span>
      </td>
      <td style="padding:12px 16px;font-size:12px;color:#6b7280;text-align:center;border-bottom:1px solid #e5e7eb;">${lastScanned}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">

    <!-- Header -->
    <div style="background:#0f172a;padding:24px 32px;">
      <p style="color:#94a3b8;margin:0;font-size:12px;letter-spacing:1px;text-transform:uppercase;">CyberShield Weekly Digest</p>
      <h1 style="color:#ffffff;margin:8px 0 0;font-size:22px;font-weight:700;">Your Weekly Security Report</h1>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 24px;">
        Here&apos;s how your websites are performing this week. Stay on top of these scores to keep your business safe online.
      </p>

      <!-- Overall score -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px;text-align:center;">
        <p style="margin:0 0 4px;color:#64748b;font-size:13px;">Overall Average Score</p>
        <p style="margin:0;font-size:48px;font-weight:800;color:${avgColor};">${overallAvg}<span style="font-size:20px;color:#94a3b8;">/100</span></p>
        <p style="margin:8px 0 0;font-size:13px;color:#64748b;">Across ${data.websites.length} monitored website${data.websites.length !== 1 ? 's' : ''}</p>
      </div>

      <!-- Sites table -->
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;margin-bottom:24px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:10px 16px;font-size:11px;font-weight:600;color:#6b7280;text-align:left;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;">Website</th>
            <th style="padding:10px 16px;font-size:11px;font-weight:600;color:#6b7280;text-align:center;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;">Score</th>
            <th style="padding:10px 16px;font-size:11px;font-weight:600;color:#6b7280;text-align:center;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;">Risk</th>
            <th style="padding:10px 16px;font-size:11px;font-weight:600;color:#6b7280;text-align:center;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;">Last Scan</th>
          </tr>
        </thead>
        <tbody>
          ${siteRows}
        </tbody>
      </table>

      <!-- Tip box -->
      <div style="background:#eff6ff;border-left:4px solid #2563eb;padding:16px;border-radius:0 8px 8px 0;margin-bottom:24px;">
        <p style="margin:0;color:#1e40af;font-size:14px;line-height:1.5;">
          <strong>Tip:</strong> Websites scoring below 60 have known security gaps. Share your full report with your web developer to get them fixed quickly.
        </p>
      </div>

      <!-- CTA -->
      <a href="${data.digestUrl}" style="display:block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;text-align:center;font-weight:600;font-size:15px;">
        View Full Dashboard &rarr;
      </a>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
        You&apos;re receiving this weekly digest because you monitor websites on CyberShield.<br>
        <a href="${data.digestUrl}" style="color:#2563eb;">Manage preferences</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

const MONITORING_ALERT_LABELS: Record<string, string> = {
  security_score_drop: 'Security Score Drop',
  change_detected: 'Website Change Detected',
  ssl_changed: 'SSL / HTTPS Change',
  header_removed: 'Security Header Removed',
  new_script_detected: 'New Script Detected',
};

export function monitoringAlertEmail(data: {
  websiteUrl: string;
  alertType: string;
  severity: string;
  headline: string;
  summary: string;
  changes: Array<{
    label: string;
    severity: string;
    summary: string;
    before: string;
    after: string;
  }>;
  recommendedFix: string;
  reportUrl: string;
  previousScore?: number;
  currentScore?: number;
}): string {
  const severityColor =
    data.severity === 'critical' ? '#dc2626' :
    data.severity === 'high' ? '#ea580c' :
    data.severity === 'medium' ? '#ca8a04' : '#16a34a';

  const severityLabel = data.severity.charAt(0).toUpperCase() + data.severity.slice(1);
  const alertLabel = MONITORING_ALERT_LABELS[data.alertType] ?? 'Security Monitoring Alert';

  const scoreBlock =
    data.previousScore !== undefined && data.currentScore !== undefined
      ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:24px;">
          <p style="margin:0 0 8px;color:#64748b;font-size:13px;">Security Score</p>
          <p style="margin:0;font-size:20px;font-weight:700;color:#0f172a;">
            <span style="color:#94a3b8;text-decoration:line-through;">${data.previousScore}</span>
            &nbsp;&rarr;&nbsp;
            <span style="color:${severityColor};">${data.currentScore}</span>
            <span style="font-size:14px;color:#94a3b8;">/100</span>
          </p>
        </div>`
      : '';

  const changeRows = data.changes.slice(0, 5).map((change) => {
    const changeSeverityColor =
      change.severity === 'critical' ? '#dc2626' :
      change.severity === 'high' ? '#ea580c' :
      change.severity === 'medium' ? '#ca8a04' : '#16a34a';

    return `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <strong style="color:#0f172a;font-size:14px;text-transform:capitalize;">${escapeHtml(change.label)}</strong>
        <span style="background:${changeSeverityColor};color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;text-transform:uppercase;">${escapeHtml(change.severity)}</span>
      </div>
      <p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.5;">${escapeHtml(change.summary)}</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
        <tr>
          <td style="width:50%;padding:8px;background:#fef2f2;border-radius:6px 0 0 6px;vertical-align:top;">
            <p style="margin:0 0 4px;color:#991b1b;font-size:11px;font-weight:600;text-transform:uppercase;">Before</p>
            <p style="margin:0;color:#374151;word-break:break-word;">${escapeHtml(change.before)}</p>
          </td>
          <td style="width:50%;padding:8px;background:#f0fdf4;border-radius:0 6px 6px 0;vertical-align:top;">
            <p style="margin:0 0 4px;color:#166534;font-size:11px;font-weight:600;text-transform:uppercase;">After</p>
            <p style="margin:0;color:#374151;word-break:break-word;">${escapeHtml(change.after)}</p>
          </td>
        </tr>
      </table>
    </div>`;
  }).join('');

  const moreChangesNote =
    data.changes.length > 5
      ? `<p style="margin:0 0 16px;color:#64748b;font-size:13px;">…and ${data.changes.length - 5} more change(s) in your dashboard.</p>`
      : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">

    <div style="background:#0f172a;padding:24px 32px;">
      <p style="color:#94a3b8;margin:0;font-size:12px;letter-spacing:1px;text-transform:uppercase;">CyberShield Monitoring Alert</p>
      <h1 style="color:#ffffff;margin:8px 0 0;font-size:22px;font-weight:700;">${escapeHtml(alertLabel)}</h1>
    </div>

    <div style="padding:32px;">
      <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px;">
        ${escapeHtml(data.headline)}
      </p>

      <div style="text-align:center;margin-bottom:24px;">
        <span style="display:inline-block;background:${severityColor};color:#fff;font-size:12px;font-weight:700;padding:6px 14px;border-radius:99px;text-transform:uppercase;">${severityLabel} Severity</span>
      </div>

      ${scoreBlock}

      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">${escapeHtml(data.summary)}</p>

      ${data.changes.length > 0 ? `
      <h2 style="color:#0f172a;font-size:16px;margin:0 0 12px;">What changed</h2>
      ${changeRows}
      ${moreChangesNote}
      ` : ''}

      <div style="background:#eff6ff;border-left:4px solid #2563eb;padding:16px;border-radius:0 8px 8px 0;margin-bottom:24px;">
        <p style="margin:0;color:#1e40af;font-size:14px;line-height:1.5;">
          <strong>Recommended fix:</strong> ${escapeHtml(data.recommendedFix)}
        </p>
      </div>

      <a href="${data.reportUrl}" style="display:block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;text-align:center;font-weight:600;font-size:15px;">
        View Full Security Report &rarr;
      </a>
    </div>

    <div style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
        You&apos;re receiving this because you monitor <strong>${escapeHtml(data.websiteUrl)}</strong> on CyberShield.<br>
        Monitoring alerts are limited to one email per alert type every 24 hours.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function groupedMonitoringAlertEmail(data: {
  websiteCount: number;
  items: Array<{
    domain: string;
    severity: string;
    issue: string;
    whyItMatters: string;
    reportUrl?: string;
  }>;
  dashboardUrl: string;
  emailTypeLabel: string;
  reason: string;
}): string {
  const severityColor = (severity: string) =>
    severity === 'critical'
      ? '#dc2626'
      : severity === 'high'
        ? '#ea580c'
        : severity === 'medium'
          ? '#ca8a04'
          : '#16a34a';

  const itemsHtml = data.items
    .map(
      (item, index) => `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:16px;">
      <p style="margin:0 0 8px;color:#64748b;font-size:13px;font-weight:600;">${index + 1}. ${escapeHtml(item.domain)}</p>
      <p style="margin:0 0 4px;color:#374151;font-size:14px;"><strong>Severity:</strong> <span style="color:${severityColor(item.severity)};text-transform:capitalize;">${escapeHtml(item.severity)}</span></p>
      <p style="margin:0 0 4px;color:#374151;font-size:14px;"><strong>Issue:</strong> ${escapeHtml(item.issue)}</p>
      <p style="margin:0;color:#64748b;font-size:14px;line-height:1.5;"><strong>Why it matters:</strong> ${escapeHtml(item.whyItMatters)}</p>
    </div>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#0f172a;padding:24px 32px;">
      <p style="color:#94a3b8;margin:0;font-size:12px;letter-spacing:1px;text-transform:uppercase;">${escapeHtml(data.emailTypeLabel)}</p>
      <h1 style="color:#ffffff;margin:8px 0 0;font-size:22px;font-weight:700;">CyberShield monitoring update</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px;">
        CyberShield completed monitoring for your websites.
      </p>
      <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
        <strong>${data.websiteCount}</strong> website${data.websiteCount === 1 ? '' : 's'} currently need attention:
      </p>
      ${itemsHtml}
      <a href="${data.dashboardUrl}" style="display:block;background:#2563eb;color:#fff;text-decoration:none;padding:14px 24px;border-radius:8px;text-align:center;font-weight:600;margin-bottom:24px;">
        View full details in your CyberShield dashboard
      </a>
      <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;text-align:center;">
        ${escapeHtml(data.reason)}
      </p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
