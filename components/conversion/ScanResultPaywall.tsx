'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { getSeverityCategory, getUrgencyMessage } from '@/lib/conversion/urgency';
import { computeSecurityCoverage } from '@/lib/conversion/coverage';
import { useConversionOptional } from './ConversionProvider';
import { usePaywallTiming } from '@/lib/analytics/usePaywallTiming';
import { trackEvent } from '@/lib/analytics/events';
import { useScanResultViralTriggers } from '@/lib/viral/triggers';
import { MAX_PUBLIC_SCANS_PER_DAY, getPublicScanCount } from '@/lib/conversion/limits';
import { evaluateScanFunnel } from '@/lib/funnel';
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

  const severity = getSeverityCategory(result.score);
  const urgency = getUrgencyMessage(result.score, result.url);
  const lockedCount =
    result.lockedIssuesCount ?? Math.max(0, result.vulnerabilitiesCount - result.issues.length);
  const scansUsed = getPublicScanCount();
  const topIssues = result.issues.slice(0, funnel.topIssuesCount);
  const paywallVisible = showPaywall;
  const coveragePercent = computeSecurityCoverage(topIssues.length, result.vulnerabilitiesCount);
  const scoreUrgent = result.score < 60;

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
    conversion?.openUpgradeModal({
      score: result.score,
      domain: result.url,
      trigger: trigger === 'pro_fix' ? 'full_report' : trigger,
      recommendedPlan: funnel.recommendedPlan,
    });
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
    <div className="mt-8 rounded-xl border border-gray-700/60 bg-gray-900/60 p-5 text-left sm:p-6">
      <SecurityCoverageBar percent={coveragePercent} className="mb-6" />

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div
          className={`flex h-28 w-28 shrink-0 flex-col items-center justify-center rounded-full border-4 ${scoreRingColor(result.score)}`}
        >
          <span className="text-3xl font-bold">{result.score}</span>
          <span className="text-xs text-gray-400">/ 100</span>
        </div>
        <div className="flex-1 text-center sm:text-left">
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${severityBadgeClass(severity.level)}`}
          >
            {severity.label} Risk — {severity.description}
          </span>
          <p className="mt-3 text-sm font-medium text-white">{result.url}</p>
          <p className="mt-1 text-sm text-gray-400">{urgency.subtext}</p>
        </div>
      </div>

      {scoreUrgent && paywallVisible && (
        <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm font-semibold text-red-200">
            Urgent: vulnerabilities need immediate attention
          </p>
          <p className="mt-1 text-xs text-red-200/80">
            Your score is below 60. Enable protection to fix vulnerabilities automatically and
            prevent exploitation.
          </p>
          <button
            type="button"
            onClick={() => handleProUpgrade('pro_fix')}
            className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500"
          >
            Fix vulnerabilities automatically (Pro)
          </button>
        </div>
      )}

      {topIssues.length > 0 && (
        <div className="mt-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Top Issues ({topIssues.length} of {result.vulnerabilitiesCount})
          </p>
          <ul className="space-y-2">
            {topIssues.map((issue) => (
              <li key={issue} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {funnel.showEnterpriseReview && paywallVisible && (
        <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
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
            className="mt-3 inline-flex rounded-lg border border-amber-500/40 px-4 py-2 text-sm font-medium text-amber-100 transition-colors hover:border-amber-400 hover:text-white"
          >
            Request security review
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
        <div className="mt-6 rounded-lg border border-gray-700/50 bg-gray-800/30 p-5 text-center">
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
              Unlock full protection report
            </button>
          </div>
        </div>
      )}

      {paywallVisible && (
        <div className="mt-6">
          <LockedFeaturePreview
            title={
              lockedCount > 0
                ? `+${lockedCount} hidden risk${lockedCount !== 1 ? 's' : ''} in full report`
                : 'Change detection & trend tracking'
            }
            description={
              lockedCount > 0
                ? 'Full vulnerability details, remediation steps, and exploit scenarios are not enabled on the Free plan.'
                : 'Continuous monitoring detects when your site changes and alerts you to new risks. Not enabled on the Free plan.'
            }
            ctaLabel={scoreUrgent ? 'Fix vulnerabilities automatically (Pro)' : 'Enable protection'}
            onCtaClick={() => handleEnableProtection(lockedCount > 0 ? 'locked_blur' : 'change_detection')}
            previewLines={
              lockedCount > 0
                ? [
                    'Hidden risk: outdated TLS configuration',
                    'Hidden risk: missing security header',
                    'Remediation steps for SQL injection vector',
                    'Exploit scenario analysis locked',
                  ]
                : [
                    'Website change detected since last scan',
                    'New endpoint exposed in attack surface',
                    'SSL certificate rotation pending',
                  ]
            }
          />
        </div>
      )}

      {paywallVisible && lockedCount === 0 && (
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => handleProUpgrade(isSecondScan ? 'second_scan' : 'full_report')}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500 sm:flex-1"
          >
            Start continuous protection
          </button>
          <button
            type="button"
            onClick={openShare}
            className="w-full rounded-lg border border-gray-700 px-4 py-3 text-sm font-medium text-gray-400 transition-colors hover:border-gray-600 hover:text-white sm:w-auto"
          >
            Share
          </button>
        </div>
      )}

      {paywallVisible && lockedCount > 0 && (
        <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => handleProUpgrade(isSecondScan ? 'second_scan' : 'full_report')}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            Unlock full protection report
          </button>
          <button
            type="button"
            onClick={openShare}
            className="text-sm text-gray-500 hover:text-gray-300"
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
