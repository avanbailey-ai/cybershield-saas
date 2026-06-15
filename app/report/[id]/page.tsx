import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { gateReport } from '@/lib/accessControl';
import type { RiskLevel, UserPlan, HeaderChecks } from '@/types';

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
  findings: unknown;
  breakdown: unknown;
  recommendations: unknown;
  is_public: boolean;
  websites: { url: string; label: string | null } | null;
}

function riskColor(level: RiskLevel | null): string {
  switch (level) {
    case 'critical': return 'text-red-400';
    case 'high':     return 'text-orange-400';
    case 'medium':   return 'text-yellow-400';
    case 'low':      return 'text-green-400';
    default:         return 'text-gray-400';
  }
}

function riskBadge(level: RiskLevel | null): string {
  switch (level) {
    case 'critical': return 'bg-red-500/15 text-red-400 border-red-500/30';
    case 'high':     return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
    case 'medium':   return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
    case 'low':      return 'bg-green-500/15 text-green-400 border-green-500/30';
    default:         return 'bg-gray-500/15 text-gray-400 border-gray-500/30';
  }
}

function riskScoreBar(score: number | null): string {
  if (score === null) return 'bg-gray-600';
  if (score <= 40) return 'bg-red-500';
  if (score <= 60) return 'bg-orange-500';
  if (score <= 80) return 'bg-yellow-500';
  return 'bg-green-500';
}

function categoryBar(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReportPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch scan with joined website
  const { data: scan, error } = await supabase
    .from('scans')
    .select('id, user_id, website_id, started_at, completed_at, security_score, ssl_valid, headers, issues, passed, explanation, risk_score, risk_level, findings, breakdown, recommendations, is_public, websites(url, label, user_id)')
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

  const scanRow = scan as unknown as ScanRow;

  // Verify ownership
  if (scanRow.user_id !== user.id) {
    redirect('/dashboard');
  }

  // Get user plan from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  const plan = (profile?.plan ?? 'free') as UserPlan;
  const riskScore = scanRow.risk_score ?? 0;
  const riskLevel = scanRow.risk_level ?? null;

  const gate = gateReport(riskScore, plan, user.email);

  // Fetch last 5 scans for same website (scan history)
  interface PastScan {
    id: string;
    security_score: number | null;
    risk_level: RiskLevel | null;
    completed_at: string | null;
  }
  let pastScans: PastScan[] = [];
  if (scanRow.website_id) {
    const { data: pastData } = await supabase
      .from('scans')
      .select('id, security_score, risk_level, completed_at')
      .eq('website_id', scanRow.website_id)
      .eq('status', 'completed')
      .neq('id', id)
      .order('completed_at', { ascending: false })
      .limit(5);
    pastScans = (pastData ?? []) as PastScan[];
  }

  // Prefer findings over breakdown for backward compat
  const findings = (Array.isArray(scanRow.findings) ? scanRow.findings :
    Array.isArray(scanRow.breakdown) ? scanRow.breakdown : []) as string[];
  const recommendations = (Array.isArray(scanRow.recommendations) ? scanRow.recommendations : []) as string[];
  const issues = scanRow.issues ?? [];
  const passed = scanRow.passed ?? [];
  const headers = scanRow.headers;

  const siteRaw = scanRow.websites as unknown;
  const site = (Array.isArray(siteRaw) ? siteRaw[0] : siteRaw) as { url: string; label: string | null } | null;
  const siteLabel = site?.label ?? site?.url ?? 'Unknown Site';
  const siteUrl = site?.url ?? '';

  const scannedAt = scanRow.completed_at
    ? new Date(scanRow.completed_at).toLocaleString()
    : new Date(scanRow.started_at).toLocaleString();

  const headerChecks = [
    { key: 'csp' as keyof HeaderChecks, label: 'Content-Security-Policy' },
    { key: 'hsts' as keyof HeaderChecks, label: 'Strict-Transport-Security (HSTS)' },
    { key: 'xFrame' as keyof HeaderChecks, label: 'X-Frame-Options' },
    { key: 'xContentType' as keyof HeaderChecks, label: 'X-Content-Type-Options' },
    { key: 'referrerPolicy' as keyof HeaderChecks, label: 'Referrer-Policy' },
    { key: 'permissionsPolicy' as keyof HeaderChecks, label: 'Permissions-Policy' },
  ];

  // Derive categories from stored data if not available
  const derivedCategories = (() => {
    let tlsPenalty = 0;
    let headerPenalty = 0;
    let exposurePenalty = 0;

    if (!scanRow.ssl_valid) tlsPenalty = 40;
    if (headers) {
      if (!headers.hsts) headerPenalty += 10;
      if (!headers.csp) headerPenalty += 10;
      if (!headers.xFrame) headerPenalty += 8;
      if (!headers.xContentType) headerPenalty += 8;
      if (!headers.referrerPolicy) headerPenalty += 5;
      if (!headers.permissionsPolicy) headerPenalty += 4;
    }
    const serverIssue = findings.some(f => /server version/i.test(f));
    const poweredIssue = findings.some(f => /x-powered-by/i.test(f));
    if (serverIssue) exposurePenalty += 10;
    if (poweredIssue) exposurePenalty += 10;

    const mixedContent = findings.some(f => /mixed content/i.test(f));
    const endpoints = findings.some(f => /sensitive endpoint/i.test(f));
    const frontendPenalty = (mixedContent ? 15 : 0) + (endpoints ? 10 : 0);

    return {
      tls: Math.max(0, Math.min(100, 100 - (tlsPenalty / 40) * 100)),
      headers: Math.max(0, Math.min(100, 100 - (headerPenalty / 40) * 100)),
      exposure: Math.max(0, Math.min(100, 100 - (exposurePenalty / 20) * 100)),
      frontend: Math.max(0, Math.min(100, 100 - (frontendPenalty / 25) * 100)),
    };
  })();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <span className="text-xs text-gray-600">Scan Report</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        {/* Site info + risk badge */}
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

          <div className="flex flex-col items-start gap-2 sm:items-end">
            {riskLevel && (
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${riskBadge(riskLevel)}`}>
                {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} Risk
              </span>
            )}
            {scanRow.security_score !== null && (
              <span className="text-xs text-gray-500">
                Security Score: {scanRow.security_score}/100
              </span>
            )}
          </div>
        </div>

        {/* Risk score meter */}
        <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300">Risk Score</h2>
            {gate.canViewFull ? (
              <span className={`text-2xl font-bold ${riskColor(riskLevel)}`}>
                {riskScore}<span className="text-sm text-gray-500">/100</span>
              </span>
            ) : (
              <span className="text-sm text-gray-500">Upgrade to view</span>
            )}
          </div>
          {gate.canViewFull && (
            <>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-800">
                <div
                  className={`h-full rounded-full transition-all ${riskScoreBar(riskScore)}`}
                  style={{ width: `${Math.min(100, riskScore)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Lower is better. Score of 0 means no risk factors detected.
              </p>
            </>
          )}
          {!gate.canViewFull && riskLevel && (
            <p className="text-sm text-gray-400 mt-1">
              Risk Level: <span className={`font-semibold ${riskColor(riskLevel)}`}>{riskLevel ? riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1) : ''}</span>
            </p>
          )}
        </div>

        {/* Explanation — always visible to all users */}
        {scanRow.explanation && (
          <div className="mb-6 rounded-xl border border-blue-500/20 bg-blue-500/5 p-6">
            <h2 className="mb-2 text-sm font-semibold text-gray-300">Security Summary</h2>
            <p className="text-sm leading-relaxed text-gray-300">{scanRow.explanation}</p>
          </div>
        )}

        {/* SSL status (always visible) */}
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
                <span className="text-sm text-green-400 font-medium">HTTPS Enabled</span>
              </>
            ) : (
              <>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20">
                  <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </span>
                <span className="text-sm text-red-400 font-medium">No HTTPS — traffic is unencrypted</span>
              </>
            )}
          </div>
        </div>

        {/* Gated section */}
        {gate.canViewFull ? (
          <>
            {/* Category scores */}
            <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
              <h2 className="mb-4 text-sm font-semibold text-gray-300">Security Categories</h2>
              <div className="space-y-3">
                {([
                  { label: 'TLS / HTTPS', value: derivedCategories.tls },
                  { label: 'Security Headers', value: derivedCategories.headers },
                  { label: 'Server Exposure', value: derivedCategories.exposure },
                  { label: 'Frontend Safety', value: derivedCategories.frontend },
                ] as { label: string; value: number }[]).map(({ label, value }) => (
                  <div key={label}>
                    <div className="mb-1 flex justify-between text-xs text-gray-400">
                      <span>{label}</span>
                      <span>{Math.round(value)}/100</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
                      <div
                        className={`h-full rounded-full ${categoryBar(value)}`}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Security Headers */}
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

            {/* Findings */}
            {findings.length > 0 && (
              <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
                <h2 className="mb-4 text-sm font-semibold text-gray-300">Risk Findings</h2>
                <ul className="space-y-2">
                  {findings.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 rounded-lg bg-gray-800/50 px-4 py-3">
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                      <span className="text-sm text-gray-300">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Passed checks */}
            {passed.length > 0 && (
              <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
                <h2 className="mb-4 text-sm font-semibold text-gray-300">Passed Checks</h2>
                <ul className="space-y-2">
                  {passed.map((item, i) => (
                    <li key={i} className="flex items-center gap-3 rounded-lg bg-gray-800/50 px-4 py-3">
                      <svg className="h-4 w-4 shrink-0 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-gray-300">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Issues */}
            {issues.length > 0 && (
              <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
                <h2 className="mb-4 text-sm font-semibold text-gray-300">Issues Found</h2>
                <ul className="space-y-2">
                  {issues.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 rounded-lg bg-gray-800/50 px-4 py-3">
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span className="text-sm text-gray-300">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
                <h2 className="mb-4 text-sm font-semibold text-gray-300">Recommendations</h2>
                <ol className="space-y-3">
                  {recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-3 rounded-lg bg-gray-800/50 px-4 py-3">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-400">
                        {i + 1}
                      </span>
                      <span className="text-sm text-gray-300">{rec}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

          </>
        ) : (
          /* Locked upgrade card for free users */
          <div className="mb-6 rounded-xl border border-gray-700 bg-gray-900 p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-gray-700 bg-gray-800">
              <svg className="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-white">Full Report Locked</h3>
            <p className="mb-6 text-sm text-gray-400">
              {gate.genericMessage}
            </p>
            <p className="mb-6 text-xs text-gray-500">
              Upgrade to see: header-by-header analysis, full risk breakdown, prioritized recommendations, and historical trend data.
            </p>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
            >
              Upgrade to Pro →
            </Link>
          </div>
        )}
        {/* Scan History */}
        {pastScans.length > 0 && (
          <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="mb-4 text-sm font-semibold text-gray-300">Scan History for this website</h2>
            <ul className="space-y-2">
              {pastScans.map((ps) => {
                const scoreClass = ps.security_score !== null
                  ? ps.security_score >= 90 ? 'bg-green-500/10 text-green-400 border-green-500/20'
                  : ps.security_score >= 70 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                  : ps.security_score >= 50 ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                  : 'bg-red-500/10 text-red-400 border-red-500/20'
                  : 'bg-gray-500/10 text-gray-400 border-gray-500/20';
                return (
                  <li key={ps.id} className="flex items-center justify-between rounded-lg bg-gray-800/50 px-4 py-3">
                    <span className="text-sm text-gray-400">
                      {ps.completed_at ? new Date(ps.completed_at).toLocaleDateString() : 'Unknown date'}
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
    </div>
  );
}
