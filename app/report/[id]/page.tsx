import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { gateReport } from '@/lib/accessControl';
import { auditLog } from '@/lib/audit/log';
import { getActiveOrgId } from '@/lib/org/context';
import { getEffectivePlan } from '@/lib/auth/permissions';
import { getUserWithPlan } from '@/lib/billing/planService';
import type { RiskLevel, UserPlan, HeaderChecks } from '@/types';
import SecurityTrendPanel from '@/components/dashboard/SecurityTrendPanel';
import SecurityFindingsPanel from '@/components/report/SecurityFindingsPanel';
import SecurityOverviewPanel from '@/components/report/SecurityOverviewPanel';
import SecurityPostureTimeline from '@/components/report/SecurityPostureTimeline';
import SecurityReportEmptyState from '@/components/report/SecurityReportEmptyState';
import SecurityRecommendationsPanel from '@/components/report/SecurityRecommendationsPanel';
import { buildIntelligenceReport } from '@/lib/report/intelligenceFromScan';
import ReportProblemOnReport from '@/components/beta/ReportProblemOnReport';

interface ScanRow {
  id: string;
  user_id: string;
  website_id: string;
  started_at: string;
  completed_at: string | null;
  security_score: number | null;
  ssl_valid: boolean | null;
  headers: HeaderChecks | null;
  issues: string[] | null;
  passed: string[] | null;
  explanation: string | null;
  risk_score: number | null;
  risk_level: RiskLevel | null;
  scan_snapshot: unknown;
  is_public: boolean;
  websites: { url: string; label: string | null } | null;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReportPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: scan, error } = await supabase
    .from('scans')
    .select(
      'id, user_id, org_id, website_id, started_at, completed_at, security_score, ssl_valid, headers, issues, passed, explanation, risk_score, risk_level, scan_snapshot, is_public, websites(url, label, user_id)',
    )
    .eq('id', id)
    .single();

  if (error || !scan) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-300">No scan data found for this report.</p>
          <Link href="/dashboard" className="mt-4 inline-block text-sm text-blue-400 hover:text-blue-300">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const scanRow = scan as unknown as ScanRow & { org_id?: string | null };

  let canView = scanRow.user_id === user.id;
  if (!canView && scanRow.org_id) {
    const orgId = await getActiveOrgId(user.id);
    canView = orgId === scanRow.org_id;
  }
  if (!canView) {
    redirect('/dashboard');
  }

  auditLog({
    userId: user.id,
    orgId: scanRow.org_id ?? (await getActiveOrgId(user.id)),
    action: 'report_accessed',
    metadata: { scanId: id },
  });

  const orgId = await getActiveOrgId(user.id);
  const userWithPlan = await getUserWithPlan(user.id, orgId);
  const plan = getEffectivePlan(userWithPlan) as UserPlan;
  const riskScore = scanRow.risk_score ?? 0;

  const gate = gateReport(riskScore, plan, user.email, userWithPlan.subscription_status);

  interface PastScan {
    id: string;
    security_score: number | null;
    risk_level: RiskLevel | null;
    completed_at: string | null;
    issues: string[] | null;
    scan_snapshot: unknown;
    ssl_valid: boolean | null;
    headers: unknown;
  }

  let pastScans: PastScan[] = [];
  let previousScan: PastScan | null = null;

  if (scanRow.website_id) {
    const { data: pastData } = await supabase
      .from('scans')
      .select('id, security_score, risk_level, completed_at, issues, scan_snapshot, ssl_valid, headers')
      .eq('website_id', scanRow.website_id)
      .eq('status', 'completed')
      .neq('id', id)
      .order('completed_at', { ascending: false })
      .limit(5);

    pastScans = (pastData ?? []) as PastScan[];
    previousScan = pastScans[0] ?? null;
  }

  const siteRaw = scanRow.websites as unknown;
  const site = (Array.isArray(siteRaw) ? siteRaw[0] : siteRaw) as { url: string; label: string | null } | null;
  const siteLabel = site?.label ?? site?.url ?? 'Unknown Site';
  const siteUrl = site?.url ?? '';

  const intelligence = buildIntelligenceReport(siteUrl, scanRow, previousScan);

  const scannedAt = scanRow.completed_at
    ? new Date(scanRow.completed_at).toLocaleString()
    : new Date(scanRow.started_at).toLocaleString();

  const passed = scanRow.passed ?? [];
  const headers = scanRow.headers;

  const headerChecks = [
    { key: 'csp' as keyof HeaderChecks, label: 'Content-Security-Policy' },
    { key: 'hsts' as keyof HeaderChecks, label: 'Strict-Transport-Security (HSTS)' },
    { key: 'xFrame' as keyof HeaderChecks, label: 'X-Frame-Options' },
    { key: 'xContentType' as keyof HeaderChecks, label: 'X-Content-Type-Options' },
    { key: 'referrerPolicy' as keyof HeaderChecks, label: 'Referrer-Policy' },
    { key: 'permissionsPolicy' as keyof HeaderChecks, label: 'Permissions-Policy' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <span className="text-xs text-gray-600">Security Report</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{siteLabel}</h1>
            {siteUrl && (
              <a
                href={siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 break-all text-sm text-blue-400 hover:text-blue-300"
              >
                {siteUrl}
              </a>
            )}
            <p className="mt-2 text-xs text-gray-500">Scanned {scannedAt}</p>
          </div>
        </div>

        <SecurityOverviewPanel report={intelligence} locked={!gate.canViewFull} />

        {gate.canViewFull && (
          <SecurityPostureTimeline
            previousScore={previousScan?.security_score ?? null}
            currentScore={intelligence.securityScore}
            changeSummary={intelligence.changeSummary}
          />
        )}

        <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-4 text-sm font-semibold text-gray-300">SSL / HTTPS</h2>
          <div className="flex items-center gap-3">
            {scanRow.ssl_valid ? (
              <>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20">
                  <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span className="text-sm font-medium text-green-400">HTTPS Enabled</span>
              </>
            ) : (
              <>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20">
                  <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </span>
                <span className="text-sm font-medium text-red-400">No HTTPS — traffic is unencrypted</span>
              </>
            )}
          </div>
        </div>

        {gate.canViewFull ? (
          <>
            {intelligence.findings.length === 0 ? (
              <SecurityReportEmptyState report={intelligence} />
            ) : (
              <SecurityFindingsPanel findings={intelligence.findings} />
            )}

            <SecurityRecommendationsPanel
              recommendations={intelligence.recommendations}
              findings={intelligence.findings}
            />

            {headers && (
              <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
                <h2 className="mb-4 text-sm font-semibold text-gray-300">Security Headers</h2>
                <ul className="space-y-2">
                  {headerChecks.map(({ key, label }) => {
                    const headerPassed = headers[key] === true;
                    return (
                      <li key={key} className="flex items-center justify-between rounded-lg bg-gray-800/50 px-4 py-3">
                        <span className="text-sm text-gray-200">{label}</span>
                        {headerPassed ? (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-green-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                            Present
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-red-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                            Missing
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {passed.length > 0 && (
              <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
                <h2 className="mb-4 text-sm font-semibold text-gray-300">Passed Checks</h2>
                <ul className="space-y-2">
                  {passed.map((item) => (
                    <li key={item} className="flex items-center gap-3 rounded-lg bg-gray-800/50 px-4 py-3">
                      <svg className="h-4 w-4 shrink-0 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-gray-300">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {scanRow.website_id && (
              <SecurityTrendPanel websiteId={scanRow.website_id} period={30} />
            )}
          </>
        ) : (
          <div className="mb-6 rounded-xl border border-gray-700 bg-gray-900 p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-gray-700 bg-gray-800">
              <svg className="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-white">Full protection report locked</h3>
            <p className="mb-4 text-sm text-gray-400">{gate.genericMessage}</p>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
              Not enabled on Free plan
            </p>
            <p className="mb-6 text-xs text-gray-500">
              Detailed findings, remediation steps, and security trend charts require a paid monitoring plan.
            </p>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
            >
              Enable protection →
            </Link>
          </div>
        )}

        {pastScans.length > 0 && (
          <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="mb-4 text-sm font-semibold text-gray-300">Scan History for this website</h2>
            <ul className="space-y-2">
              {pastScans.map((ps) => {
                const scoreClass =
                  ps.security_score !== null
                    ? ps.security_score >= 90
                      ? 'bg-green-500/10 text-green-400 border-green-500/20'
                      : ps.security_score >= 70
                        ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                        : ps.security_score >= 50
                          ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                    : 'bg-gray-500/10 text-gray-400 border-gray-500/20';
                return (
                  <li key={ps.id} className="flex items-center justify-between rounded-lg bg-gray-800/50 px-4 py-3">
                    <span className="text-sm text-gray-400">
                      {ps.completed_at
                        ? new Date(ps.completed_at).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })
                        : 'Unknown date'}
                    </span>
                    <div className="flex items-center gap-3">
                      {ps.security_score !== null && (
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${scoreClass}`}>
                          {ps.security_score}/100
                        </span>
                      )}
                      <Link href={`/report/${ps.id}`} className="text-xs text-blue-400 hover:text-blue-300">
                        View →
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </main>
      <ReportProblemOnReport
        reportId={scan.id}
        websiteId={scan.website_id}
        userEmail={user.email}
      />
    </div>
  );
}
