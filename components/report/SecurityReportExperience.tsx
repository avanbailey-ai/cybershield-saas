'use client';

import Link from 'next/link';
import { useState } from 'react';
import type {
  ExecutiveReportPresentation,
  ReportViewMode,
} from '@/lib/report/reportExecutiveCopy';
import type { FindingActionContext, ReportHandoffMeta } from '@/lib/findings';
import { buildCombinedHandoffItems, buildRecommendedFixOrder } from '@/lib/findings';
import type { SecurityFinding, SecurityRecommendation } from '@/lib/securityIntelligence/types';
import SecurityFindingCard from './SecurityFindingCard';
import SecurityRecommendationsPanel from './SecurityRecommendationsPanel';
import FindingActionBar from './FindingActionBar';
import DeveloperHandoffBar from './DeveloperHandoffBar';
import RemediationAssistantPanel from './RemediationAssistantPanel';
import CustomerReportPanel from '@/components/intelligence/CustomerReportPanel';
import { riskScoreColor } from './severityStyles';
import type { SecurityIntelligenceReport } from '@/lib/securityIntelligence/types';

interface SecurityReportExperienceProps {
  presentation: ExecutiveReportPresentation;
  findings: SecurityFinding[];
  recommendations: SecurityRecommendation[];
  sslValid: boolean | null;
  actionContext?: FindingActionContext;
  handoffMeta?: ReportHandoffMeta;
  intelligenceReport?: SecurityIntelligenceReport;
  siteLabel?: string;
  siteUrl?: string;
  planLevel?: 'free' | 'pro' | 'growth' | 'agency' | 'enterprise';
}

function ViewModeToggle({
  mode,
  onChange,
}: {
  mode: ReportViewMode;
  onChange: (mode: ReportViewMode) => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Report view</span>
      <div className="flex rounded-lg border border-gray-700 bg-gray-900 p-1">
        <button
          type="button"
          onClick={() => onChange('executive')}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            mode === 'executive'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Executive view
        </button>
        <button
          type="button"
          onClick={() => onChange('technical')}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            mode === 'technical'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Technical view
        </button>
      </div>
    </div>
  );
}

function trendClass(direction: string): string {
  switch (direction) {
    case 'improving':
      return 'text-green-400';
    case 'declining':
      return 'text-amber-400';
    default:
      return 'text-gray-400';
  }
}

function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case 'Urgent':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-300';
    case 'Recommended':
      return 'border-blue-500/30 bg-blue-500/10 text-blue-300';
    default:
      return 'border-gray-600 bg-gray-800 text-gray-400';
  }
}

export default function SecurityReportExperience({
  presentation,
  findings,
  recommendations,
  sslValid,
  actionContext,
  handoffMeta,
  intelligenceReport,
  siteLabel,
  siteUrl,
  planLevel,
}: SecurityReportExperienceProps) {
  const [viewMode, setViewMode] = useState<ReportViewMode>('executive');
  const {
    snapshot,
    scoreChange,
    monitoringValue,
    strengthGroups,
    scoreExplanation,
    fixTheseFirst,
    groupedFindings,
    plan,
    progress,
  } = presentation;

  const trendLabel = scoreChange.trendLabel;

  const scoreRiskLevel =
    scoreExplanation.score >= 80
      ? 'low'
      : scoreExplanation.score >= 60
        ? 'medium'
        : scoreExplanation.score >= 40
          ? 'high'
          : 'critical';

  const isUrgentSection = fixTheseFirst.sectionLabel === 'Fix These First';

  const priorityFindingIds = fixTheseFirst.actions.map((a) => a.findingId);
  const recommendedFixOrder =
    findings.length > 0
      ? buildRecommendedFixOrder(buildCombinedHandoffItems(findings, priorityFindingIds))
      : [];

  const resolvedHandoff: ReportHandoffMeta | undefined =
    handoffMeta ??
    (intelligenceReport
      ? {
          scanDate: progress.lastScanLabel,
          securityScore: snapshot.trustScore,
          riskLevel:
            intelligenceReport.riskLevel.charAt(0).toUpperCase() +
            intelligenceReport.riskLevel.slice(1),
        }
      : undefined);

  return (
    <>
      <ViewModeToggle mode={viewMode} onChange={setViewMode} />

      {intelligenceReport && siteLabel && siteUrl && (
        <div className="mb-6">
          <CustomerReportPanel
            siteLabel={siteLabel}
            siteUrl={siteUrl}
            report={intelligenceReport}
            findings={findings}
            sslValid={sslValid}
            planLevel={planLevel}
          />
        </div>
      )}

      {/* 1. Executive Snapshot */}
      <section className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Executive Snapshot
        </h2>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-baseline gap-4">
            <p
              className={`text-5xl font-bold tabular-nums ${riskScoreColor(scoreRiskLevel)}`}
            >
              {snapshot.trustScore}
              <span className="text-xl font-normal text-gray-500">/100</span>
            </p>
            <div>
              <p className="text-sm font-semibold text-white">Website Trust Score</p>
              <p className="text-sm text-gray-400">{snapshot.band}</p>
              <p className="mt-1 inline-flex rounded-full border border-gray-700 bg-gray-800 px-2.5 py-0.5 text-xs font-medium text-gray-300">
                {snapshot.status}
              </p>
            </div>
          </div>
          <Link
            href={monitoringValue.ctaHref}
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            {snapshot.monitoringCtaLabel}
          </Link>
        </div>

        <p className="mt-5 text-base leading-relaxed text-gray-200">{snapshot.mainTakeaway}</p>

        <div className="mt-5 rounded-lg border border-gray-800 bg-gray-950/50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Recommended action
          </p>
          <p className="mt-1 text-sm text-gray-200">{snapshot.recommendedAction}</p>
        </div>
      </section>

      {/* 2. Why Your Score Changed */}
      {scoreChange.show && (
        <section className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-amber-400/90">
            {scoreChange.headline}
          </h2>
          <p className="text-sm text-gray-300">
            <span className="font-medium text-white">
              {scoreChange.previousScore} → {scoreChange.currentScore}
            </span>
            {' · '}
            {scoreChange.whatChanged}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-gray-400">{scoreChange.interpretation}</p>
          <p className="mt-3 text-sm font-medium text-gray-200">{scoreChange.nextStep}</p>
        </section>
      )}

      {/* 3. Recommended Website Trust Improvements */}
      {fixTheseFirst.actions.length > 0 && (
        <section
          className={`mb-6 rounded-xl border p-6 ${
            isUrgentSection
              ? 'border-amber-500/20 bg-amber-500/5'
              : 'border-blue-500/20 bg-blue-500/5'
          }`}
        >
          <h2
            className={`mb-4 text-sm font-semibold uppercase tracking-wider ${
              isUrgentSection ? 'text-amber-400/90' : 'text-blue-400/90'
            }`}
          >
            {fixTheseFirst.sectionLabel}
          </h2>
          <ol className="space-y-3">
            {fixTheseFirst.actions.map((action) => (
              <li
                key={action.findingId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-800 bg-gray-900/80 px-4 py-3"
              >
                <div className="min-w-0">
                  <span
                    className={`text-xs font-bold ${
                      isUrgentSection ? 'text-amber-400' : 'text-blue-400'
                    }`}
                  >
                    #{action.rank}
                  </span>
                  <p className="mt-0.5 text-sm font-medium text-white">{action.title}</p>
                  <p className="text-xs text-gray-500">
                    {action.effort.label} · {action.effort.timeRange}
                  </p>
                </div>
                <p className="text-xs text-gray-400">
                  <span className="text-gray-500">Est. impact: </span>
                  <span className="font-semibold text-green-400/90">
                    +{action.estimatedGain} pts → {action.projectedScore}/100
                  </span>
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* 4. What This Means for Your Business */}
      {groupedFindings.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-gray-500">
            What This Means for Your Business
          </h2>
          <p className="mb-4 text-sm text-gray-500">
            Business impact first — expand any item for developer notes and remediation tools.
          </p>

          {actionContext && resolvedHandoff && findings.length > 0 && (
            <DeveloperHandoffBar
              findings={findings}
              actionContext={actionContext}
              handoff={resolvedHandoff}
              priorityFindingIds={priorityFindingIds}
              className="mb-5"
            />
          )}

          {recommendedFixOrder.length > 0 && (
            <div className="mb-5 rounded-xl border border-gray-800 bg-gray-900/60 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Recommended fix order
              </h3>
              <ol className="mt-3 space-y-2">
                {recommendedFixOrder.map((title, index) => (
                  <li key={`${index}-${title}`} className="flex gap-3 text-sm text-gray-300">
                    <span className="shrink-0 font-semibold text-blue-400">{index + 1}.</span>
                    <span>{title}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="space-y-5">
            {groupedFindings.map((group) => (
              <div key={group.name}>
                <h3 className="mb-3 text-sm font-semibold text-gray-400">{group.name}</h3>
                <div className="space-y-3">
                  {group.findings.map((view) => {
                    const finding = findings.find((f) => f.id === view.findingId);
                    if (!finding) return null;
                    return (
                      <ExecutiveFindingCard
                        key={view.findingId}
                        finding={finding}
                        view={view}
                        technicalMode={viewMode === 'technical'}
                        actionContext={actionContext}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. Security Strengths (compressed) */}
      {strengthGroups.some((g) => g.active) && (
        <section className="mb-6 rounded-xl border border-green-500/20 bg-green-500/5 p-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-green-400/90">
            Security Strengths
          </h2>
          <p className="mb-4 text-sm text-gray-400">
            Proof your site already has trust foundations in place.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {strengthGroups.map((group) => (
              <li
                key={group.label}
                className={`rounded-lg border px-4 py-3 ${
                  group.active
                    ? 'border-green-500/20 bg-gray-900/60'
                    : 'border-gray-800 bg-gray-950/40 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                      group.active
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-gray-800 text-gray-500'
                    }`}
                  >
                    {group.active ? '✓' : '—'}
                  </span>
                  <p className="text-sm font-medium text-green-300">{group.label}</p>
                </div>
                {group.active && (
                  <p className="mt-1.5 pl-7 text-xs leading-relaxed text-gray-400">{group.detail}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 6. Why ongoing monitoring matters */}
      <section className="mb-6 rounded-xl border border-blue-500/25 bg-gradient-to-br from-blue-500/10 to-gray-900 p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-blue-400">
          {monitoringValue.title}
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-gray-300">{monitoringValue.body}</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {monitoringValue.bullets.map((bullet) => (
            <li key={bullet} className="flex items-center gap-2 text-sm text-gray-300">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
              {bullet}
            </li>
          ))}
        </ul>
        <Link
          href={monitoringValue.ctaHref}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
        >
          Start Pro Monitoring — {monitoringValue.priceLabel}
        </Link>
      </section>

      {/* 30-Day Plan */}
      {plan.some((w) => w.tasks.length > 0) && (
        <section className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
            30-Day Security Improvement Plan
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {plan.map((week) => (
              <div
                key={week.week}
                className="rounded-lg border border-gray-800 bg-gray-950/50 p-4"
              >
                <h3 className="text-sm font-semibold text-white">{week.title}</h3>
                <ul className="mt-3 space-y-2">
                  {week.tasks.map((task) => (
                    <li key={task} className="text-sm text-gray-300">
                      • {task}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Monitoring History */}
      <section className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Monitoring History
        </h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-gray-800 bg-gray-950/50 px-4 py-3">
            <p className="text-xs text-gray-500">Last scan</p>
            <p className="mt-1 text-sm font-semibold text-white">{progress.lastScanLabel}</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-950/50 px-4 py-3">
            <p className="text-xs text-gray-500">Best score</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {progress.bestScore !== null ? `${progress.bestScore}/100` : '—'}
            </p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-950/50 px-4 py-3">
            <p className="text-xs text-gray-500">Current</p>
            <p className="mt-1 text-sm font-semibold text-white">{progress.currentScore}/100</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-950/50 px-4 py-3">
            <p className="text-xs text-gray-500">Trend</p>
            <p className={`mt-1 text-sm font-semibold ${trendClass(progress.trend.direction)}`}>
              {trendLabel}
            </p>
          </div>
        </div>
      </section>

      {viewMode === 'technical' && (
        <>
          <section className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
              Score details
            </h2>
            <p className="text-sm leading-relaxed text-gray-400">
              {scoreExplanation.percentileContext}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Score drivers
                </p>
                <ul className="mt-2 space-y-1">
                  {scoreExplanation.scoreDrivers.map((driver) => (
                    <li key={driver} className="text-sm text-gray-300">
                      • {driver}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Positive factors
                </p>
                <ul className="mt-2 space-y-1">
                  {scoreExplanation.positiveFactors.map((factor) => (
                    <li key={factor} className="text-sm text-green-300/90">
                      • {factor}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="mb-4 text-sm font-semibold text-gray-300">SSL / HTTPS</h2>
            <div className="flex items-center gap-3">
              {sslValid ? (
                <>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20">
                    <svg
                      className="h-4 w-4 text-green-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span className="text-sm font-medium text-green-400">HTTPS Enabled</span>
                </>
              ) : (
                <>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20">
                    <svg
                      className="h-4 w-4 text-red-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </span>
                  <span className="text-sm font-medium text-red-400">
                    No HTTPS — traffic is unencrypted
                  </span>
                </>
              )}
            </div>
          </section>

          <SecurityRecommendationsPanel recommendations={recommendations} findings={findings} />
          {findings.map((finding) => (
            <div key={`tech-${finding.id}`} className="mb-4">
              <SecurityFindingCard finding={finding} actionContext={actionContext} />
            </div>
          ))}
        </>
      )}
    </>
  );
}

function ExecutiveFindingCard({
  finding,
  view,
  technicalMode,
  actionContext,
}: {
  finding: SecurityFinding;
  view: ExecutiveReportPresentation['findingViews'][0];
  technicalMode: boolean;
  actionContext?: FindingActionContext;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);
  const { business } = view;

  return (
    <article className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-white">{business.plainTitle}</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${priorityBadgeClass(business.priorityLabel)}`}
            >
              {business.priorityLabel}
            </span>
            <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[10px] font-semibold text-gray-400">
              {view.effort.label} · {view.effort.timeRange}
            </span>
            <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold text-green-400">
              Est. +{view.scoreImpact.estimatedGain} pts
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 text-xs font-semibold text-blue-400 hover:text-blue-300"
        >
          {expanded ? 'Hide details' : 'Developer notes'}
        </button>
      </div>

      <dl className="mt-4 space-y-3">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            What we found
          </dt>
          <dd className="mt-1 text-sm text-gray-300">{business.whatWeFound}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Why it matters
          </dt>
          <dd className="mt-1 text-sm text-gray-300">{business.whyItMatters}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Recommended fix
          </dt>
          <dd className="mt-1 text-sm text-gray-300">{business.developerAction}</dd>
        </div>
        {business.notConfirmedVulnerability && (
          <p className="text-xs text-gray-500 italic">
            This is a detected exposure or configuration signal — not a confirmed active vulnerability.
          </p>
        )}
      </dl>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-gray-800 pt-4">
          <RemediationAssistantPanel finding={finding} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Impact if fixed
            </p>
            <p className="mt-1 text-sm text-gray-300">
              Estimated {view.scoreImpact.currentScore}/100 → {view.scoreImpact.projectedScore}/100
              (+{view.scoreImpact.estimatedGain} pts if addressed)
            </p>
          </div>
          {actionContext && (
            <FindingActionBar
              finding={finding}
              context={actionContext}
              variant="secondary"
            />
          )}
          {technicalMode ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Technical Explanation
              </p>
              <p className="mt-1 text-sm leading-relaxed text-gray-400">
                {view.technicalExplanation}
              </p>
              <pre className="mt-3 overflow-x-auto rounded-lg border border-gray-800 bg-gray-950/80 px-4 py-3 font-mono text-xs whitespace-pre-wrap text-emerald-300/90">
                {finding.fix}
              </pre>
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => setShowTechnical(!showTechnical)}
                className="text-xs font-semibold uppercase tracking-wider text-blue-400 hover:text-blue-300"
              >
                {showTechnical ? 'Hide' : 'Show'} Technical Explanation
              </button>
              {showTechnical && (
                <p className="mt-2 text-sm leading-relaxed text-gray-400">
                  {view.technicalExplanation}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
