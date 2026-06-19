import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicReportByToken } from '@/lib/share/reportShare';
import SecurityFindingCard from '@/components/report/SecurityFindingCard';
import SecurityOverviewPanel from '@/components/report/SecurityOverviewPanel';
import SecurityReportEmptyState from '@/components/report/SecurityReportEmptyState';
import { formatRiskLevel, riskBadgeClass } from '@/components/report/severityStyles';

interface PageProps {
  params: Promise<{ id: string }>;
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-green-400 border-green-500/40';
  if (score >= 40) return 'text-yellow-400 border-yellow-500/40';
  return 'text-red-400 border-red-500/40';
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const report = await getPublicReportByToken(id);

  if (!report) {
    return { title: 'Scan Not Found — CyberShield' };
  }

  const title = `${report.domain} scored ${report.securityScore}/100 on CyberShield`;
  const riskLabel = formatRiskLevel(report.riskLevel);

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

  const overviewReport = {
    summary: report.summary,
    securityScore: report.securityScore,
    riskLevel: report.riskLevel as 'low' | 'medium' | 'high' | 'critical',
    attackSurfaceScore: report.attackSurfaceScore,
    attackSurfaceLevel: report.attackSurfaceLevel as 'Low' | 'Medium' | 'High' | 'Critical',
    changeSummary: {
      posture: 'no_change' as const,
      scoreDelta: null,
      highlights: ['Shared report preview'],
    },
  };

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
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Security Intelligence Report</h1>
          <p className="mt-2 text-gray-400">{report.domain}</p>
          <p className="mx-auto mt-3 max-w-lg text-sm text-gray-500">
            This is a snapshot from a single scan. Continuous monitoring tracks changes over time —
            SSL expiry, downtime, and security posture shifts.
          </p>
          <span
            className={`mt-3 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${riskBadgeClass(report.riskLevel)}`}
          >
            {formatRiskLevel(report.riskLevel)} Risk
          </span>
        </div>

        <div className="mt-8 flex flex-col items-center">
          <div
            className={`flex h-32 w-32 flex-col items-center justify-center rounded-full border-4 ${scoreColor(report.securityScore)}`}
          >
            <span className="text-4xl font-bold">{report.securityScore}</span>
            <span className="text-xs text-gray-400">/ 100</span>
          </div>
          <p className="mt-1 text-xs text-gray-500">Higher score = better security</p>
        </div>

        <div className="mt-8">
          <SecurityOverviewPanel report={overviewReport} />
        </div>

        {report.findingPreviews.length === 0 ? (
          <SecurityReportEmptyState report={overviewReport} />
        ) : (
          <section className="mt-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
              Top Findings (preview)
            </h2>
            <div className="space-y-4">
              {report.findingPreviews.map((finding) => (
                <SecurityFindingCard key={finding.title} finding={finding} compact />
              ))}
            </div>
            <p className="mt-4 text-xs text-gray-500">
              This preview shows the top finding details from one scan. Run your own free scan for a
              score and top findings, or enable monitoring for remediation guidance, alerts, and
              change history.
            </p>
          </section>
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
          One scan shows today.{' '}
          <Link href="/pricing" className="text-blue-400 hover:text-blue-300">
            Enable continuous monitoring
          </Link>{' '}
          to track SSL, uptime, and changes over time.
        </p>
      </main>
    </div>
  );
}
