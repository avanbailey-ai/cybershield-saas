'use client';

import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { getSeverityCategory, getUrgencyMessage } from '@/lib/conversion/urgency';
import { computeSecurityCoverage } from '@/lib/conversion/coverage';
import { useConversionOptional } from './ConversionProvider';
import { usePaywallTiming } from '@/lib/analytics/usePaywallTiming';
import { trackEvent } from '@/lib/analytics/events';
import { useScanResultViralTriggers } from '@/lib/viral/triggers';
import { MAX_PUBLIC_SCANS_PER_DAY, getPublicScanCount } from '@/lib/conversion/limits';
import { evaluateScanFunnel, buildPricingHref, saveFunnelSession } from '@/lib/funnel';
import SecurityCoverageBar from './SecurityCoverageBar';
import LockedFeaturePreview from './LockedFeaturePreview';

export interface PublicScanResult {
  url: string;
  score: number;
  riskLevel: string;
  issues: string[];
  vulnerabilitiesCount: number;
  genericMessage: string;
  riskDetected: boolean;
  lockedIssuesCount?: number;
  shareToken?: string | null;
}

interface ScanResultPaywallProps {
  result: PublicScanResult;
  isSecondScan?: boolean;
  priorScore?: number | null;
  onUpgradeClick?: () => void;
  onRescanClick?: () => void;
}

function scoreRingColor(score: number): string {
  if (score >= 70) return 'text-green-400 border-green-500/40';
  if (score >= 40) return 'text-yellow-400 border-yellow-500/40';
  return 'text-red-400 border-red-500/40';
}

function severityBadgeClass(level: 'low' | 'medium' | 'high'): string {
  switch (level) {
    case 'low':
      return 'bg-green-500/15 text-green-300 border-green-500/30';
    case 'medium':
      return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30';
    case 'high':
      return 'bg-red-500/15 text-red-300 border-red-500/30';
  }
}

function issueHeadline(issue: string): string {
  const trimmed = issue.trim();
  if (trimmed.length <= 60) return trimmed;
  const cut = trimmed.slice(0, 57);
  return cut.endsWith(' ') ? `${cut.trim()}…` : `${cut}…`;
}

export default function ScanResultPaywall({
  result,
  isSecondScan = false,
  priorScore = null,
  onUpgradeClick,
  onRescanClick,
}: ScanResultPaywallProps) {
  const conversion = useConversionOptional();
  const { showPaywall, requireExplicitClick, revealPaywall } = usePaywallTiming();
  const { shareModal, openShare } = useScanResultViralTriggers({
    domain: result.url,
    score: result.score,
    shareToken: result.shareToken,
    reportViewed: showPaywall,
  });

  const funnel = useMemo(
    () =>
      evaluateScanFunnel({
        score: result.score,
        riskLevel: result.riskLevel,
        issues: result.issues,
        vulnerabilitiesCount: result.vulnerabilitiesCount,
        domain: result.url,
        priorScore,
      }),
    [result, priorScore],
  );

  useEffect(() => {
    saveFunnelSession({
      scanned_site: result.url,
      score: result.score,
      risk_level: result.riskLevel,
      issue_count: result.vulnerabilitiesCount,
    });
  }, [result]);

  const severity = getSeverityCategory(result.score);
  const urgency = getUrgencyMessage(result.score, result.url);
  const lockedCount =
    result.lockedIssuesCount ?? Math.max(0, result.vulnerabilitiesCount - result.issues.length);
  const scansUsed = getPublicScanCount();
  const topIssues = result.issues.slice(0, funnel.topIssuesCount);
  const paywallVisible = showPaywall;
  const coveragePercent = computeSecurityCoverage(topIssues.length, result.vulnerabilitiesCount);
  const scoreAtRisk = result.score < 70;

  function navigateToPricing(plan: 'pro' | 'growth' = funnel.recommendedPlan) {
    window.location.href = buildPricingHref(plan);
  }

  function handleProUpgrade(trigger: 'full_report' | 'export' | 'second_scan' | 'pro_fix') {
    trackEvent('upgrade_clicked', {
      domain: result.url,
      trigger,
      plan: funnel.recommendedPlan,
      score: result.score,
    });
    if (onUpgradeClick) {
      onUpgradeClick();
      return;
    }
    navigateToPricing();
  }

  function handleEnableProtection(trigger: string) {
    trackEvent('upgrade_clicked', {
      domain: result.url,
      trigger,
      score: result.score,
      plan: funnel.recommendedPlan,
    });
    handleProUpgrade('full_report');
  }

  function handleRescan() {
    if (onRescanClick) {
      onRescanClick();
      return;
    }
    window.location.href = '/scan';
  }

  return (
    <div className="mt-8 rounded-xl border border-gray-700/60 bg-gray-900/60 p-5 text-left sm:p-8">
      <SecurityCoverageBar percent={coveragePercent} className="mb-8" />

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <div
          className={`flex h-36 w-36 shrink-0 flex-col items-center justify-center rounded-full border-[5px] ${scoreRingColor(result.score)}`}
        >
          <span className="text-5xl font-bold">{result.score}</span>
          <span className="text-sm text-gray-400">/ 100</span>
        </div>
        <div className="flex-1 text-center sm:text-left">
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${severityBadgeClass(severity.level)}`}
          >
            {severity.label} Risk — {severity.description}
          </span>
          <p className="mt-3 text-base font-medium text-white">{result.url}</p>
          <p className="mt-2 text-sm text-gray-400">{urgency.subtext}</p>
        </div>
      </div>

      {topIssues.length > 0 && (
        <div className="mt-8">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Top findings ({topIssues.length} of {result.vulnerabilitiesCount})
          </p>
          <ul className="space-y-3">
            {topIssues.map((issue, i) => (
              <li
                key={issue}
                className="rounded-lg border border-gray-700/50 bg-gray-800/30 px-4 py-3"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-red-400/80">
                  Finding #{i + 1}
                </p>
                <p className="mt-1 text-sm font-semibold text-white">{issueHeadline(issue)}</p>
                <p className="mt-1 text-xs text-gray-500 blur-[3px] select-none">
                  Remediation steps and exploit details locked on Free plan
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {scoreAtRisk && paywallVisible && (
        <div className="mt-8 rounded-lg border border-red-500/30 bg-red-500/10 p-5">
          <p className="text-sm font-semibold text-red-200">
            Your site scored below 70 — vulnerabilities need attention
          </p>
          <p className="mt-1 text-xs text-red-200/80">
            Attackers scan for exactly these gaps. Pro fixes vulnerabilities automatically with
            daily monitoring and remediation guidance.
          </p>
          <button
            type="button"
            onClick={() => handleProUpgrade('pro_fix')}
            className="mt-4 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500"
          >
            Fix vulnerabilities automatically
          </button>
        </div>
      )}

      {funnel.showEnterpriseReview && paywallVisible && (
        <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-5">
          <p className="text-sm font-semibold text-amber-200">Security review recommended</p>
          <p className="mt-1 text-xs text-amber-200/80">
            Critical exposure detected. Request an automated security review for your domain.
          </p>
          <Link
            href={funnel.enterpriseHref}
            onClick={() =>
              trackEvent('upgrade_clicked', {
                domain: result.url,
                trigger: 'enterprise_review',
                score: result.score,
                funnelTriggers: funnel.triggers.join(','),
              })
            }
            className="mt-4 inline-flex rounded-lg border border-amber-500/40 px-5 py-2.5 text-sm font-medium text-amber-100 transition-colors hover:border-amber-400 hover:text-white"
          >
            Request Security Review
          </Link>
        </div>
      )}

      {isSecondScan && !paywallVisible && (
        <div className="mt-6 rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3">
          <p className="text-sm text-blue-200">
            {scansUsed} of {MAX_PUBLIC_SCANS_PER_DAY} free scans used today.
          </p>
          <p className="mt-1 text-xs text-blue-200/70">
            One-time scans miss changes. Enable continuous protection to stay covered.
          </p>
        </div>
      )}

      {requireExplicitClick && !showPaywall && lockedCount > 0 && (
        <div className="mt-8 rounded-lg border border-gray-700/50 bg-gray-800/30 p-5 text-center">
          <p className="mb-3 text-sm text-gray-400">
            {lockedCount} hidden risk{lockedCount !== 1 ? 's' : ''} detected in your full report.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => {
                revealPaywall();
                trackEvent('report_viewed', { domain: result.url, trigger: 'explicit_click' });
              }}
              className="rounded-lg border border-gray-600 px-5 py-2.5 text-sm font-semibold text-gray-200 hover:border-gray-500 hover:text-white"
            >
              View scan summary
            </button>
            <button
              type="button"
              onClick={() => handleProUpgrade('pro_fix')}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Enable continuous protection
            </button>
          </div>
        </div>
      )}

      {paywallVisible && (
        <div className="mt-8 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Locked insights — enable continuous protection
          </p>

          <LockedFeaturePreview
            title="Attack surface mapping"
            description="Full endpoint inventory, exposed admin panels, and open port analysis — not available on Free."
            ctaLabel="Enable continuous protection"
            onCtaClick={() => handleEnableProtection('attack_surface')}
            previewLines={[
              'Exposed API endpoint: /api/v1/admin',
              'Subdomain enumeration: 12 assets found',
              'Open port 8080 detected on production',
              'Debug endpoint accessible externally',
            ]}
          />

          <LockedFeaturePreview
            title="Change detection"
            description="Continuous monitoring alerts you when SSL, headers, or endpoints change between scans."
            ctaLabel="Enable continuous protection"
            onCtaClick={() => handleEnableProtection('change_detection')}
            previewLines={[
              'Website change detected since last scan',
              'New endpoint exposed in attack surface',
              'SSL certificate rotation pending',
              'Security header removed from response',
            ]}
          />

          <LockedFeaturePreview
            title="Exploit modeling"
            description="See how attackers could chain your vulnerabilities into a breach scenario."
            ctaLabel={scoreAtRisk ? 'Fix vulnerabilities automatically' : 'Enable continuous protection'}
            onCtaClick={() => handleEnableProtection('exploit_modeling')}
            previewLines={[
              'SQL injection vector → database access path',
              'Missing CSP → XSS payload delivery scenario',
              'Header misconfiguration → session hijack chain',
              'Remediation priority ranked by exploitability',
            ]}
          />
        </div>
      )}

      {paywallVisible && (
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => handleProUpgrade(isSecondScan ? 'second_scan' : 'full_report')}
            className="w-full rounded-lg bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 sm:w-auto"
          >
            Enable continuous protection
          </button>
          <button
            type="button"
            onClick={openShare}
            className="w-full rounded-lg border border-gray-700 px-6 py-3 text-sm font-medium text-gray-400 transition-colors hover:border-gray-600 hover:text-white sm:w-auto"
          >
            Share results
          </button>
        </div>
      )}

      {paywallVisible && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={handleRescan}
            className="text-sm text-gray-500 hover:text-gray-300"
          >
            Scan another site →
          </button>
        </div>
      )}

      {shareModal}
    </div>
  );
}
