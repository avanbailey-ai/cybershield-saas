import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getActiveOrgId } from '@/lib/org/context';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import CyberShieldValueSummary from '@/components/dashboard/CyberShieldValueSummary';
import RetentionBanner from '@/components/dashboard/RetentionBanner';
import { canAccessFeature } from '@/lib/auth/featureGate';
import { getSubscriptionAccessFromSession, type SessionSubscriptionClient } from '@/lib/billing/getSubscriptionAccess';
import { getWebsiteDisplayName } from '@/lib/dashboard/dashboardCommandCenter';
import { fetchCommandCenterData } from '@/lib/dashboard/fetchCommandCenterData';
import type { HeaderChecks, RiskLevel } from '@/types';
import SecurityFindingCard from '@/components/report/SecurityFindingCard';
import { buildIntelligenceReport } from '@/lib/report/intelligenceFromScan';
import { formatRiskLevel, riskBadgeClass } from '@/components/report/severityStyles';

export const metadata: Metadata = {
  title: 'Reports — CyberShield',
};

function scoreBadgeClass(score: number): string {
  if (score >= 90) return 'bg-green-500/10 text-green-400 border border-green-500/20';
  if (score >= 70) return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
  if (score >= 50) return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
  return 'bg-red-500/10 text-red-400 border border-red-500/20';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface ScanReport {
  id: string;
  security_score: number | null;
  risk_level: RiskLevel | null;
  ssl_valid: boolean | null;
  issues: string[] | null;
  passed: string[] | null;
  explanation: string | null;
  completed_at: string | null;
  started_at: string;
  headers: HeaderChecks | null;
  scan_snapshot: unknown;
  websites: { url: string; label: string | null } | null;
}

export default async function ReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const access = await getSubscriptionAccessFromSession(
    supabase as unknown as SessionSubscriptionClient,
    user.id,
    user.email,
  );

  if (!canAccessFeature({ email: user.email, plan: access.plan, subscription_status: access.status }, 'alerts')) {
    redirect('/app/settings?upgrade=reports');
  }

  const orgId = await getActiveOrgId(user.id);
  const commandCenter = await fetchCommandCenterData(supabase, user.id, user.email, orgId);

  const { data: rawScans } = await supabase
    .from('scans')
    .select(
      'id, security_score, risk_level, ssl_valid, issues, passed, explanation, completed_at, started_at, headers, scan_snapshot, websites(url, label)',
    )
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(10);

  const scans = (rawScans ?? []) as unknown as ScanReport[];

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <DashboardHeader email={user.email ?? ''} title="Reports" />

      <main className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="mb-6 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white">Security Reports</h2>
            <p className="mt-1 text-sm text-gray-500">
              Executive-ready security reports with scores, findings, and fix guidance.
            </p>
          </div>

          {commandCenter.showRetentionBanner && <RetentionBanner variant="protection" />}

          <CyberShieldValueSummary metrics={commandCenter.valueSummary} compact />
        </div>

        {scans.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-700 py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-gray-700 bg-gray-800/60 text-gray-500">
              <svg
                className="h-7 w-7"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                />
              </svg>
            </div>
            <p className="text-base font-semibold text-gray-200">No reports yet</p>
            <p className="mt-2 max-w-sm text-sm text-gray-500">
              Reports are automatically generated after security scans complete. Add a website and
              run your first scan to see your security report here.
            </p>
            <Link
              href="/app/websites"
              className="mt-6 inline-flex items-center rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
            >
              Go to Websites
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {scans.map((scan) => {
              const site = scan.websites;
              const siteUrl = site?.url ?? '';
              const intelligence = buildIntelligenceReport(siteUrl, scan);
              const previewFindings = intelligence.findings.slice(0, 2);

              return (
                <div
                  key={scan.id}
                  className="rounded-xl border border-gray-800 bg-gray-900/50 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">
                        {getWebsiteDisplayName(site?.label, site?.url ?? '')}
                      </p>
                      {site?.label && site?.url && (
                        <p className="mt-0.5 truncate text-xs text-gray-500">{site.url}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {scan.security_score !== null && (
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${scoreBadgeClass(scan.security_score)}`}
                        >
                          {scan.security_score}/100
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${riskBadgeClass(intelligence.riskLevel)}`}
                      >
                        {formatRiskLevel(intelligence.riskLevel)}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-xs ${scan.ssl_valid ? 'text-green-400' : 'text-red-400'}`}
                      >
                        {scan.ssl_valid ? '✓' : '✗'} SSL
                      </span>
                      <span className="text-xs text-gray-500">
                        {scan.completed_at ? timeAgo(scan.completed_at) : timeAgo(scan.started_at)}
                      </span>
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-gray-400">{intelligence.summary}</p>

                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                    <span>
                      <span className="font-medium text-gray-300">{intelligence.findings.length}</span>{' '}
                      finding{intelligence.findings.length !== 1 ? 's' : ''}
                    </span>
                    <span>
                      Page exposure:{' '}
                      <span className="font-medium text-gray-300">
                        {intelligence.attackSurfaceLevel}
                      </span>
                    </span>
                  </div>

                  {previewFindings.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {previewFindings.map((finding) => (
                        <SecurityFindingCard key={finding.id} finding={finding} compact />
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-green-400">No critical security issues detected</p>
                  )}

                  <Link
                    href={`/report/${scan.id}`}
                    className="mt-4 inline-flex text-xs font-medium text-blue-400 hover:text-blue-300"
                  >
                    View full security report →
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {scans.length > 0 && (
          <section className="mt-8 rounded-xl border border-gray-800 bg-gray-900/40 p-5">
            <h3 className="text-sm font-semibold text-white">Next step</h3>
            <p className="mt-1 text-sm text-gray-400">
              Share reports with stakeholders or open Health Center for ongoing monitoring.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/app/scans"
                className="inline-flex min-h-[40px] items-center rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-2 text-xs font-medium text-gray-200 hover:border-gray-600 hover:text-white"
              >
                View Monitoring Activity
              </Link>
              <Link
                href="/app/websites"
                className="inline-flex min-h-[40px] items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
              >
                Manage Websites
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
