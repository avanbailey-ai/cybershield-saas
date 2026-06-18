'use client';

import { useState } from 'react';
import type {
  ExecutiveReportPresentation,
  ReportViewMode,
} from '@/lib/report/reportExecutiveCopy';
import type { FindingActionContext } from '@/lib/findings';
import type { SecurityFinding, SecurityRecommendation } from '@/lib/securityIntelligence/types';
import SecurityFindingCard from './SecurityFindingCard';
import SecurityRecommendationsPanel from './SecurityRecommendationsPanel';
import FindingActionBar from './FindingActionBar';
import RemediationAssistantPanel from './RemediationAssistantPanel';
import { riskScoreColor } from './severityStyles';

interface SecurityReportExperienceProps {
  presentation: ExecutiveReportPresentation;
  findings: SecurityFinding[];
  recommendations: SecurityRecommendation[];
  sslValid: boolean | null;
  actionContext?: FindingActionContext;
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
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
}

export default function SecurityReportExperience({
  presentation,
  findings,
  recommendations,
  sslValid,
  actionContext,
}: SecurityReportExperienceProps) {
  const [viewMode, setViewMode] = useState<ReportViewMode>('executive');
  const { summary, scoreExplanation, fixTheseFirst, strengths, groupedFindings, plan, progress } =
    presentation;

  return (
    <>
      <ViewModeToggle mode={viewMode} onChange={setViewMode} />

      {/* Executive Summary */}
      <section className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Executive Summary
        </h2>
        <p className="text-lg font-semibold text-white">{summary.headline}</p>
        <ul className="mt-4 space-y-2">
          {summary.statusBullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2 text-sm text-gray-300">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
              {bullet}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm font-medium text-gray-200">{summary.overallRisk}</p>
        <p className="mt-2 text-sm text-gray-400">
          <span className="font-medium text-gray-300">Next step: </span>
          {summary.nextStep}
        </p>
      </section>

      {/* Security Score Explanation */}
      <section className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Security Score Explanation
        </h2>
        <div className="flex flex-wrap items-baseline gap-3">
          <p
            className={`text-4xl font-bold tabular-nums ${riskScoreColor(
              scoreExplanation.score >= 80
                ? 'low'
                : scoreExplanation.score >= 60
                  ? 'medium'
                  : scoreExplanation.score >= 40
                    ? 'high'
                    : 'critical',
            )}`}
          >
            {scoreExplanation.score}
            <span className="text-lg font-normal text-gray-500">/100</span>
          </p>
          <span className="rounded-full border border-gray-700 bg-gray-800 px-3 py-1 text-sm font-medium text-gray-300">
            {scoreExplanation.band}
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-gray-400">
          {scoreExplanation.percentileContext}
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Score drivers
            </p>
            <ul className="mt-2 space-y-1">
              {scoreExplanation.scoreDrivers.map((driver) => (
                <li key={driver} className="text-sm text-gray-300">• {driver}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Positive factors
            </p>
            <ul className="mt-2 space-y-1">
              {scoreExplanation.positiveFactors.map((factor) => (
                <li key={factor} className="text-sm text-green-300/90">• {factor}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Fix These First */}
      {fixTheseFirst.actions.length > 0 && (
        <section className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-amber-400/90">
            Fix These First
          </h2>
          <ol className="space-y-4">
            {fixTheseFirst.actions.map((action) => (
              <li
                key={action.findingId}
                className="rounded-lg border border-gray-800 bg-gray-900/80 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-amber-400">#{action.rank}</span>
                    <h3 className="mt-1 text-sm font-semibold text-white">{action.title}</h3>
                    <p className="mt-1 text-xs text-gray-400">
                      {action.effort.label} · {action.effort.timeRange}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="text-gray-500">Score impact preview</p>
                    <p className="mt-1 font-semibold text-green-400">
                      +{action.estimatedGain} pts → {action.projectedScore}/100
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-4 border-t border-amber-500/20 pt-4 text-sm">
            <p className="text-gray-300">
              <span className="text-gray-500">Total effort: </span>
              {fixTheseFirst.totalEffortLabel}
            </p>
            <p className="text-gray-300">
              <span className="text-gray-500">Potential improvement: </span>
              {fixTheseFirst.potentialImprovement}
            </p>
          </div>
        </section>
      )}

      {/* Security Strengths */}
      {strengths.length > 0 && (
        <section className="mb-6 rounded-xl border border-green-500/20 bg-green-500/5 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-green-400/90">
            Security Strengths
          </h2>
          <p className="mb-4 text-sm text-gray-400">What&apos;s already working on your site.</p>
          <ul className="space-y-3">
            {strengths.map((strength) => (
              <li
                key={strength.label}
                className="rounded-lg border border-gray-800 bg-gray-900/60 px-4 py-3"
              >
                <p className="text-sm font-medium text-green-300">{strength.label}</p>
                <p className="mt-1 text-sm text-gray-400">{strength.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Grouped Findings */}
      {groupedFindings.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Findings by Business Impact
          </h2>
          <p className="mb-4 text-sm text-gray-400">
            Each finding includes what it is, why it matters, business impact, and fix guidance.
            Use the remediation assistant, send-to-developer, or generate ticket actions to
            delegate fixes.
          </p>
          <div className="space-y-6">
            {groupedFindings.map((group) => (
              <div
                key={group.name}
                className="rounded-xl border border-gray-800 bg-gray-900 p-6"
              >
                <h3 className="text-base font-semibold text-white">{group.name}</h3>
                <p className="mt-1 text-sm text-gray-400">{group.description}</p>
                <div className="mt-4 space-y-4">
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
                    <li key={task} className="text-sm text-gray-300">• {task}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Security Progress */}
      <section className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Security Progress
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
              {progress.trend.deltaLabel}
            </p>
          </div>
        </div>
      </section>

      {/* SSL quick status in executive flow */}
      <section className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-300">SSL / HTTPS</h2>
        <div className="flex items-center gap-3">
          {sslValid ? (
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
      </section>

      {viewMode === 'technical' && (
        <>
          <SecurityRecommendationsPanel
            recommendations={recommendations}
            findings={findings}
          />
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

  return (
    <article className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-white">{view.title}</h4>
          <p className="mt-1 text-sm text-gray-300">{view.businessSummary}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[10px] font-semibold text-gray-400">
              {view.businessImpact.label}
            </span>
            <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[10px] font-semibold text-gray-400">
              {view.effort.label} · {view.effort.timeRange}
            </span>
            <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold text-green-400">
              +{view.scoreImpact.estimatedGain} pts
            </span>
          </div>
        </div>
        <span className="text-xs text-gray-500">{expanded ? 'Hide' : 'Details'}</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-gray-800 pt-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
              If ignored
            </p>
            <p className="mt-1 text-sm text-gray-300">{view.businessImpact.ifIgnored}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Effort
            </p>
            <p className="mt-1 text-sm text-gray-300">
              {view.effort.label} — {view.effort.timeRange}. {view.effort.expertise}.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Score impact preview
            </p>
            <p className="mt-1 text-sm text-gray-300">
              Current {view.scoreImpact.currentScore}/100 → projected {view.scoreImpact.projectedScore}/100
              (+{view.scoreImpact.estimatedGain})
            </p>
          </div>
          <div>
            <RemediationAssistantPanel finding={finding} />
          </div>
          {actionContext && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-blue-400">
                Remediation tools
              </p>
              <FindingActionBar finding={finding} context={actionContext} />
            </div>
          )}
          {technicalMode ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Technical Explanation
              </p>
              <p className="mt-1 text-sm leading-relaxed text-gray-400">
                {view.technicalExplanation}
              </p>
              <pre className="mt-3 overflow-x-auto rounded-lg border border-gray-800 bg-gray-950/80 px-4 py-3 font-mono text-xs text-emerald-300/90 whitespace-pre-wrap">
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
