'use client';

import Link from 'next/link';
import { getSeverityCategory, getUrgencyMessage } from '@/lib/conversion/urgency';
import { useConversionOptional } from './ConversionProvider';
import { usePaywallTiming } from '@/lib/analytics/usePaywallTiming';
import { trackEvent } from '@/lib/analytics/events';
import { useScanResultViralTriggers } from '@/lib/viral/triggers';
import { MAX_PUBLIC_SCANS_PER_DAY, getPublicScanCount } from '@/lib/conversion/limits';

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

function getSmbPrimaryCta(score: number): string {
  return score >= 70 ? 'Improve Security' : 'Fix these issues';
}

function getRemediationTips(score: number): string[] {
  if (score < 40) {
    return [
      'Enable HTTPS and resolve mixed-content warnings',
      'Add security headers (CSP, HSTS, X-Frame-Options)',
      'Remove or protect exposed admin and debug endpoints',
    ];
  }
  if (score < 70) {
    return [
      'Review and tighten Content-Security-Policy headers',
      'Enable automated monitoring to catch new issues early',
      'Patch outdated dependencies and third-party scripts',
    ];
  }
  return [
    'Schedule regular scans to catch regressions',
    'Keep security headers up to date as your site changes',
    'Enable alerts for score drops and new vulnerabilities',
  ];
}

export default function ScanResultPaywall({
  result,
  isSecondScan = false,
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
  const severity = getSeverityCategory(result.score);
  const urgency = getUrgencyMessage(result.score, result.url);
  const lockedCount =
    result.lockedIssuesCount ??
    Math.max(0, result.vulnerabilitiesCount - result.issues.length);
  const scansUsed = getPublicScanCount();

  function handleUpgrade(trigger: 'full_report' | 'export' | 'second_scan') {
    trackEvent('report_viewed', { domain: result.url, trigger });
    if (onUpgradeClick) {
      onUpgradeClick();
      return;
    }
    conversion?.openUpgradeModal({
      score: result.score,
      domain: result.url,
      trigger,
      recommendedPlan: urgency.highlightPlan,
    });
  }

  function handleRescan() {
    if (onRescanClick) {
      onRescanClick();
      return;
    }
    window.location.href = '/scan';
  }

  const smbPrimaryCta = getSmbPrimaryCta(result.score);
  const remediationTips = getRemediationTips(result.score);
  const paywallVisible = showPaywall;
  const enterpriseHref = '/enterprise/pricing';

  return (
    <div className="mt-8 rounded-xl border border-gray-700/60 bg-gray-900/60 p-5 text-left sm:p-6">
      {/* Value moment: score + top issues (always visible) */}
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

      {result.issues.length > 0 && (
        <div className="mt-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Top Issues ({Math.min(result.issues.length, 2)} of {result.vulnerabilitiesCount})
          </p>
          <ul className="space-y-2">
            {result.issues.slice(0, 2).map((issue) => (
              <li key={issue} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {paywallVisible && (
        <div className="mt-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Quick fixes to try
          </p>
          <ul className="space-y-2">
            {remediationTips.map((tip) => (
              <li key={tip} className="flex items-start gap-2 text-sm text-gray-400">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Second scan inline nudge — no modal */}
      {isSecondScan && !paywallVisible && (
        <div className="mt-6 rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3">
          <p className="text-sm text-blue-200">
            {scansUsed} of {MAX_PUBLIC_SCANS_PER_DAY} free scans used today.
          </p>
          <p className="mt-1 text-xs text-blue-200/70">
            Review your results below, then upgrade for continuous monitoring.
          </p>
        </div>
      )}

      {requireExplicitClick && !showPaywall && lockedCount > 0 && (
        <div className="mt-6 rounded-lg border border-gray-700/50 bg-gray-800/30 p-5 text-center">
          <p className="mb-3 text-sm text-gray-400">
            Your full report includes {lockedCount} additional finding{lockedCount !== 1 ? 's' : ''}.
          </p>
          <button
            type="button"
            onClick={() => {
              revealPaywall();
              trackEvent('report_viewed', { domain: result.url, trigger: 'explicit_click' });
            }}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
          >
            View full report
          </button>
        </div>
      )}

      {/* Paywall: blurred findings */}
      {lockedCount > 0 && paywallVisible && (
        <div className="relative mt-6 overflow-hidden rounded-lg border border-gray-700/50">
          <div className="space-y-2 p-4 blur-sm select-none" aria-hidden="true">
            {Array.from({ length: Math.min(lockedCount, 4) }).map((_, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-gray-500">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-600" />
                Additional vulnerability detail hidden — upgrade to unlock
              </div>
            ))}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/75 px-4 py-6">
            <svg
              className="mb-2 h-7 w-7 text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0V10.5m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
            <p className="mb-4 text-center text-sm font-medium text-white">
              +{lockedCount} more issue{lockedCount !== 1 ? 's' : ''} in full report
            </p>
            <button
              type="button"
              onClick={() => handleUpgrade(isSecondScan ? 'second_scan' : 'full_report')}
              className="w-full max-w-xs rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
            >
              {smbPrimaryCta}
            </button>
          </div>
        </div>
      )}

      {/* Single primary CTA when no locked blur section */}
      {paywallVisible && lockedCount === 0 && (
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => handleUpgrade(isSecondScan ? 'second_scan' : 'full_report')}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500 sm:flex-1"
          >
            {smbPrimaryCta}
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
        <div className="mt-4 flex justify-center">
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

      {/* Enterprise — opt-in secondary section, separate from SMB flow */}
      {paywallVisible && (
        <div className="mt-8 rounded-lg border border-gray-700/50 bg-gray-800/20 p-4">
          <p className="text-sm font-semibold text-gray-200">
            Need Continuous Security Monitoring?
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Enterprise plans include compliance reporting, 24/7 monitoring, audit trails, and
            dedicated security support for regulated teams.
          </p>
          <Link
            href={enterpriseHref}
            onClick={() =>
              trackEvent('upgrade_clicked', { domain: result.url, trigger: 'enterprise_learn' })
            }
            className="mt-4 inline-flex rounded-lg border border-gray-600 px-4 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:border-gray-500 hover:text-white"
          >
            Learn about Enterprise Protection
          </Link>
        </div>
      )}

      {shareModal}
    </div>
  );
}
