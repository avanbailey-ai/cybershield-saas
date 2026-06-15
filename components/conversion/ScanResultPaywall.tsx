'use client';

import Link from 'next/link';
import { getSeverityCategory, getUrgencyMessage } from '@/lib/conversion/urgency';
import { getPersonalizedCta } from '@/lib/conversion/personalize';
import { useConversionOptional } from './ConversionProvider';
import AdaptiveCTA, { useAdaptiveConfig } from '@/components/analytics/AdaptiveCTA';
import { usePaywallTiming } from '@/lib/analytics/usePaywallTiming';
import { trackEvent } from '@/lib/analytics/events';
import { useScanResultViralTriggers } from '@/lib/viral/triggers';
import { hasEnterpriseLevelIssues } from '@/lib/sales/detectEnterpriseScan';
import { useBrainState } from '@/lib/brain/useBrainState';

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
  onUpgradeClick?: () => void;
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

export default function ScanResultPaywall({ result, onUpgradeClick }: ScanResultPaywallProps) {
  const conversion = useConversionOptional();
  const { showPaywall, requireExplicitClick, revealPaywall } = usePaywallTiming();
  const { tier, config } = useAdaptiveConfig();
  const brain = useBrainState();
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

  function handleUpgrade(trigger: 'full_report' | 'export') {
    trackEvent('report_viewed', { domain: result.url, trigger });
    if (onUpgradeClick) {
      onUpgradeClick();
      return;
    }
    conversion?.openUpgradeModal({
      score: result.score,
      domain: result.url,
      trigger,
      recommendedPlan: config.highlightPlan ?? urgency.highlightPlan,
    });
  }

  const protectCta = getPersonalizedCta(result.url, 'protect');
  const monitorCta = getPersonalizedCta(result.url, 'monitor');
  const paywallVisible = showPaywall;
  const showEnterpriseCta =
    brain.recommendedAction === 'enterprise_demo' ||
    hasEnterpriseLevelIssues({
      vulnerabilitiesCount: result.vulnerabilitiesCount,
      score: result.score,
      url: result.url,
    });
  const emphasizeUpgrade = brain.recommendedAction === 'upgrade' || brain.intentScore >= 70;
  const enterpriseLeadHref = `/enterprise/lead?domain=${encodeURIComponent(result.url)}`;

  return (
    <div className="mt-6 rounded-xl border border-gray-700/60 bg-gray-900/60 p-6 text-left">
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
          {tier === 'low' && (
            <p className="mt-2 text-xs text-gray-500">
              Free scan complete — review your top issues below.
            </p>
          )}
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

      {requireExplicitClick && !showPaywall && lockedCount > 0 && (
        <div className="mt-6 rounded-lg border border-gray-700/50 bg-gray-800/30 p-6 text-center">
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
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/70 px-4">
            <svg
              className="mb-2 h-8 w-8 text-blue-400"
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
            <p className="mb-3 text-sm font-medium text-white">
              +{lockedCount} more issue{lockedCount !== 1 ? 's' : ''} in full report
            </p>
            {config.showPricingPressure || emphasizeUpgrade ? (
              <AdaptiveCTA
                domain={result.url}
                onClick={() => handleUpgrade('full_report')}
                fallbackLabel={getPersonalizedCta(result.url, 'full_report')}
              />
            ) : (
              <button
                type="button"
                onClick={() => handleUpgrade('full_report')}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
              >
                {getPersonalizedCta(result.url, 'full_report')}
              </button>
            )}
          </div>
        </div>
      )}

      {showEnterpriseCta && paywallVisible && (
        <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-amber-200">
            Enterprise-grade vulnerabilities detected
          </p>
          <p className="mt-1 text-xs text-amber-200/70">
            Complex infrastructure or critical findings may require a dedicated security review.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => handleUpgrade('full_report')}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Upgrade (Self-Serve)
            </button>
            <Link
              href={enterpriseLeadHref}
              onClick={() => trackEvent('upgrade_clicked', { domain: result.url, trigger: 'enterprise_cta' })}
              className="flex-1 rounded-lg border border-amber-500/40 px-4 py-2.5 text-center text-sm font-semibold text-amber-200 hover:bg-amber-500/10"
            >
              Talk to Security Expert
            </Link>
          </div>
        </div>
      )}

      {paywallVisible && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              { label: 'Daily monitoring', locked: true },
              { label: 'Email alerts', locked: true },
            ].map(({ label }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-800/40 px-3 py-2 text-sm text-gray-400"
              >
                <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0V10.5m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                {label}
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {config.showPricingPressure ? (
              <AdaptiveCTA
                domain={result.url}
                onClick={() => handleUpgrade('full_report')}
                className="flex-1"
                fallbackLabel={protectCta}
              />
            ) : (
              <button
                type="button"
                onClick={() => handleUpgrade('full_report')}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
              >
                {tier === 'low' ? 'Run another free scan' : protectCta}
              </button>
            )}
            <button
              type="button"
              onClick={openShare}
              className="rounded-lg border border-gray-700 px-4 py-3 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
            >
              Share Results
            </button>
            {config.showPricingPressure && (
              <button
                type="button"
                onClick={() => handleUpgrade('export')}
                className="rounded-lg border border-gray-700 px-4 py-3 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
              >
                Export Results
              </button>
            )}
          </div>
        </>
      )}

      {shareModal}

      {paywallVisible && config.showPricingPressure && (
        <p className="mt-4 text-center text-xs text-gray-500">{monitorCta}</p>
      )}
    </div>
  );
}
