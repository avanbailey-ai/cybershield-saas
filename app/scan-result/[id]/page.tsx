import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicReportByToken } from '@/lib/share/reportShare';

interface PageProps {
  params: Promise<{ id: string }>;
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-green-400 border-green-500/40';
  if (score >= 40) return 'text-yellow-400 border-yellow-500/40';
  return 'text-red-400 border-red-500/40';
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Low Risk';
  if (score >= 60) return 'Moderate Risk';
  if (score >= 40) return 'High Risk';
  return 'Critical Risk';
}

function severityClass(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-500/15 text-red-300 border-red-500/30';
    case 'high':
      return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
    case 'medium':
      return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30';
    default:
      return 'bg-gray-500/15 text-gray-300 border-gray-500/30';
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const report = await getPublicReportByToken(id);

  if (!report) {
    return { title: 'Scan Not Found — CyberShield' };
  }

  const title = `${report.domain} scored ${report.securityScore}/100 on CyberShield`;
  const riskLabel =
    report.securityScore >= 80
      ? 'Low Risk'
      : report.securityScore >= 60
        ? 'Moderate Risk'
        : report.securityScore >= 40
          ? 'High Risk'
          : 'Critical Risk';

  return {
    title,
    description: `${report.domain} security score: ${report.securityScore}/100 (${riskLabel}). Free scan preview on CyberShield.`,
    openGraph: {
      title,
      description: report.executiveSummary ?? `Security score: ${report.securityScore}/100 — ${riskLabel}`,
      type: 'website',
      siteName: 'CyberShield',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: `${report.domain}: ${report.securityScore}/100 security score (${riskLabel})`,
    },
  };
}

export default async function SharedScanResultPage({ params }: PageProps) {
  const { id } = await params;
  const report = await getPublicReportByToken(id);

  if (!report) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <header className="border-b border-gray-800/60 bg-[#0a0f1e]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-white">CyberShield</span>
          </Link>
          <Link href="/scan" className="text-sm text-blue-400 hover:text-blue-300">
            Scan your site →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Security Scan Results</h1>
          <p className="mt-2 text-gray-400">{report.domain}</p>
        </div>

        <div className="mt-8 flex flex-col items-center">
          <div
            className={`flex h-32 w-32 flex-col items-center justify-center rounded-full border-4 ${scoreColor(report.securityScore)}`}
          >
            <span className="text-4xl font-bold">{report.securityScore}</span>
            <span className="text-xs text-gray-400">/ 100</span>
          </div>
          <p className="mt-4 text-sm font-medium text-gray-300">{scoreLabel(report.securityScore)}</p>
          <p className="mt-1 text-xs text-gray-500">Higher score = better security</p>
        </div>

        {report.executiveSummary && (
          <div className="mt-8 rounded-xl border border-gray-800 bg-gray-900/60 p-6 text-left">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
              Executive Summary
            </h2>
            <p className="text-sm leading-relaxed text-gray-300">{report.executiveSummary}</p>
          </div>
        )}

        {report.vulnerabilityPreviews.length > 0 && (
          <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900/60 p-6 text-left">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
              Top Vulnerabilities (preview)
            </h2>
            <ul className="space-y-3">
              {report.vulnerabilityPreviews.map((vuln, i) => (
                <li
                  key={`${vuln.title}-${i}`}
                  className="flex items-center justify-between rounded-lg bg-gray-800/50 px-4 py-3"
                >
                  <span className="text-sm text-gray-300">{vuln.title}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${severityClass(vuln.severity)}`}
                  >
                    {vuln.severity}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-gray-500">
              Full vulnerability details are hidden for privacy. Run your own scan for a complete report.
            </p>
          </div>
        )}

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/scan"
            className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            Run your own free security scan
          </Link>
          <Link
            href="/leaderboard"
            className="rounded-lg border border-gray-700 px-6 py-3 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
          >
            View Leaderboard
          </Link>
        </div>

        <p className="mt-8 text-center text-xs text-gray-500">
          Want continuous monitoring?{' '}
          <Link href="/pricing" className="text-blue-400 hover:text-blue-300">
            Upgrade to CyberShield Pro
          </Link>
        </p>
      </main>
    </div>
  );
}
