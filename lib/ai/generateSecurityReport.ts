import { assessRisk } from '@/lib/riskEngine';
import type { ScanResult } from '@/lib/scanner/runScan';

export interface SecurityReport {
  summary: string;
  riskScoreExplanation: string;
  vulnerabilities: Array<{ title: string; severity: string; description: string }>;
  businessImpact: string;
  recommendations: string[];
  urgencyStatement?: string;
}

function issueSeverity(issue: string, score: number): string {
  if (/https|ssl|plaintext/i.test(issue)) return 'critical';
  if (/csp|xss|hsts|clickjacking/i.test(issue)) return 'high';
  if (score < 40) return 'high';
  if (score < 60) return 'medium';
  return 'low';
}

function issueTitle(issue: string): string {
  const colonIdx = issue.indexOf('—');
  if (colonIdx > 0) return issue.slice(0, colonIdx).trim();
  const dashIdx = issue.indexOf(' - ');
  if (dashIdx > 0) return issue.slice(0, dashIdx).trim();
  return issue.length > 60 ? issue.slice(0, 57) + '...' : issue;
}

function buildTemplateReport(scanResult: ScanResult): SecurityReport {
  const risk = assessRisk(scanResult);
  const securityScore = scanResult.score;
  const riskScore = 100 - securityScore;

  const vulnerabilities = scanResult.issues.map((issue) => ({
    title: issueTitle(issue),
    severity: issueSeverity(issue, securityScore),
    description: issue,
  }));

  const sslStatus = scanResult.ssl
    ? 'HTTPS is enabled, protecting data in transit.'
    : 'HTTPS is not enabled — all traffic is transmitted in plaintext.';

  const missingHeaders = [
    !scanResult.headers.csp && 'Content-Security-Policy',
    !scanResult.headers.hsts && 'Strict-Transport-Security',
    !scanResult.headers.xFrame && 'X-Frame-Options',
    !scanResult.headers.xContentType && 'X-Content-Type-Options',
    !scanResult.headers.referrerPolicy && 'Referrer-Policy',
    !scanResult.headers.permissionsPolicy && 'Permissions-Policy',
  ].filter(Boolean) as string[];

  const headerSummary =
    missingHeaders.length === 0
      ? 'All major security headers are present.'
      : `Missing ${missingHeaders.length} security header(s): ${missingHeaders.join(', ')}.`;

  let businessImpact: string;
  if (securityScore < 40) {
    businessImpact =
      'Critical security gaps expose your business to data breaches, SEO penalties, and loss of customer trust. ' +
      'Attackers could intercept user data or inject malicious content. Immediate remediation is recommended.';
  } else if (securityScore < 60) {
    businessImpact =
      'Notable security weaknesses increase your attack surface. While not all issues are immediately exploitable, ' +
      'they can lead to compliance gaps and erode customer confidence over time.';
  } else if (securityScore < 80) {
    businessImpact =
      'Your site has a moderate security posture. Addressing remaining gaps will strengthen compliance readiness ' +
      'and reduce the likelihood of future incidents.';
  } else {
    businessImpact =
      'Your website demonstrates strong security fundamentals. Continued monitoring ensures new vulnerabilities ' +
      'are caught before they impact your business.';
  }

  let urgencyStatement: string | undefined;
  if (securityScore < 40) {
    urgencyStatement =
      'Act within 24 hours — critical vulnerabilities are actively exploitable and may already be indexed by security scanners.';
  } else if (securityScore < 60) {
    urgencyStatement =
      'Address these issues within the next week to prevent escalation and maintain customer trust.';
  }

  const riskScoreExplanation =
    `Security score: ${securityScore}/100 (risk score: ${riskScore}/100, ${scanResult.riskLevel} risk). ` +
    `${sslStatus} ${headerSummary} ` +
    `${vulnerabilities.length} issue(s) detected across SSL, headers, and configuration checks.`;

  return {
    summary: scanResult.explanation,
    riskScoreExplanation,
    vulnerabilities,
    businessImpact,
    recommendations: risk.recommendations,
    urgencyStatement,
  };
}

async function enhanceWithOpenAI(
  report: SecurityReport,
  scanResult: ScanResult,
): Promise<SecurityReport> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return report;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a cybersecurity analyst. Rewrite the summary in 2-3 clear sentences for a business owner. Return only the summary text, no markdown.',
          },
          {
            role: 'user',
            content: `Domain: ${scanResult.url}\nScore: ${scanResult.score}/100\nIssues: ${scanResult.issues.join('; ')}\nCurrent summary: ${report.summary}`,
          },
        ],
        max_tokens: 200,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return report;

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const enhanced = data.choices?.[0]?.message?.content?.trim();
    if (enhanced) {
      return { ...report, summary: enhanced };
    }
  } catch (err) {
    console.warn('[generateSecurityReport] OpenAI enhancement skipped:', err);
  }

  return report;
}

export async function generateSecurityReport(scanResult: ScanResult): Promise<SecurityReport> {
  const templateReport = buildTemplateReport(scanResult);
  return enhanceWithOpenAI(templateReport, scanResult);
}
