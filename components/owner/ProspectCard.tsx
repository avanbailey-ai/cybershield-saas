'use client';

import { useState } from 'react';
import HygieneControls from './HygieneControls';
import {
  opportunityScoreLabel,
  planFitLabel,
  prospectNextStep,
  securityScoreLabel,
  recommendedAction,
  confidenceLabel,
  contactStatusLabel,
} from '@/lib/owner/pipeline';
import type { OwnerProspect } from '@/lib/owner/types';

interface Props {
  prospect: OwnerProspect;
  selected: boolean;
  scanning: boolean;
  onToggle: () => void;
  onScan: () => void;
  onGenerateOutreach: () => void;
  onArchive: () => void;
  onIgnoreForever: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
}

function locationLabel(p: OwnerProspect): string {
  return [p.city, p.state, p.country].filter(Boolean).join(', ') || '—';
}

export default function ProspectCard({
  prospect: p,
  selected,
  scanning,
  onToggle,
  onScan,
  onGenerateOutreach,
  onArchive,
  onIgnoreForever,
  onUnarchive,
  onDelete,
}: Props) {
  const [showContact, setShowContact] = useState(false);
  const nextStep = prospectNextStep(p);
  const planFit = planFitLabel(p);
  const action = recommendedAction(p);
  const reasons = Array.isArray(p.qualification_reasons) ? p.qualification_reasons : [];
  const contact = contactStatusLabel(p);
  const confidence = confidenceLabel(p.conversion_likelihood, p.opportunity_score);

  return (
    <article className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={selected} onChange={onToggle} className="mt-1.5" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-xl font-semibold tracking-tight text-white">{p.business_name}</h3>
              <p className="mt-1 text-sm text-gray-400">
                {p.industry ?? 'Business'} · {locationLabel(p)}
              </p>
              <a
                href={p.website.startsWith('http') ? p.website : `https://${p.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block truncate text-sm text-violet-400 hover:text-violet-300"
              >
                {p.website}
              </a>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <ScorePill label="Opportunity" value={opportunityScoreLabel(p)} accent="violet" />
              <ScorePill label="Security" value={securityScoreLabel(p)} accent="amber" />
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {planFit && (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <p className="text-[10px] uppercase text-gray-500">Recommended plan</p>
                <p className="text-sm font-medium text-emerald-300">{planFit}</p>
              </div>
            )}
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <p className="text-[10px] uppercase text-gray-500">Confidence</p>
              <p className="text-sm font-medium text-white">{confidence}</p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <p className="text-[10px] uppercase text-gray-500">Contact</p>
              <p
                className={`text-sm font-medium ${contact.available ? 'text-emerald-300' : 'text-gray-500'}`}
              >
                {contact.label}
              </p>
            </div>
          </div>

          {reasons.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Why this business matters
              </p>
              <ul className="mt-2 space-y-1">
                {reasons.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-emerald-400">✓</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 rounded-lg border border-violet-500/20 bg-violet-500/5 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-violet-300/80">
              Recommended next action
            </p>
            <p className="mt-1 text-sm font-medium text-white">{action.label}</p>
            <p className="mt-0.5 text-xs text-gray-500">{nextStep}</p>
          </div>

          {showContact && (
            <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-gray-300">
              {p.contact_email && <p>Email: {p.contact_email}</p>}
              {p.contact_phone && <p>Phone: {p.contact_phone}</p>}
              {p.contact_linkedin && (
                <p>
                  LinkedIn:{' '}
                  <a href={p.contact_linkedin} className="text-violet-400" target="_blank" rel="noreferrer">
                    {p.contact_linkedin}
                  </a>
                </p>
              )}
              {!p.contact_email && !p.contact_phone && !p.contact_linkedin && (
                <p className="text-gray-500">No contact details found on website yet.</p>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onGenerateOutreach}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
            >
              Generate outreach
            </button>
            <button
              type="button"
              onClick={() => setShowContact((v) => !v)}
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:border-violet-500/50"
            >
              Contact info
            </button>
            {action.action === 'scan' && (
              <button
                type="button"
                onClick={onScan}
                disabled={scanning}
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:border-violet-500/50 disabled:opacity-50"
              >
                {scanning ? 'Scanning…' : p.scan_status === 'completed' ? 'Re-scan' : 'Run scan'}
              </button>
            )}
            <HygieneControls
              compact
              archived={p.pipeline_state === 'archived' || p.pipeline_state === 'ignore_forever'}
              onArchive={async () => onArchive()}
              onUnarchive={async () => onUnarchive()}
              onDelete={async () => onDelete()}
            />
            {p.pipeline_state !== 'ignore_forever' && (
              <button
                type="button"
                onClick={onIgnoreForever}
                className="text-sm text-gray-500 hover:text-gray-300"
              >
                Ignore forever
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function ScorePill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: 'violet' | 'amber';
}) {
  const colors =
    accent === 'violet'
      ? 'border-violet-500/30 bg-violet-500/5 text-violet-300'
      : 'border-amber-500/30 bg-amber-500/5 text-amber-200';
  return (
    <div className={`rounded-xl border px-4 py-2 text-center ${colors}`}>
      <p className="text-[10px] uppercase opacity-70">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
