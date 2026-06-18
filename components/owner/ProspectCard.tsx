'use client';

import { useState } from 'react';
import HygieneControls from './HygieneControls';
import {
  opportunityScoreLabel,
  planFitLabel,
  prospectNextStep,
  securityScoreLabel,
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

function ContactBadge({ ok, label }: { ok: boolean | null; label: string }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] ${
        ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-800 text-gray-600'
      }`}
    >
      {label}
    </span>
  );
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
  const reasons = Array.isArray(p.qualification_reasons) ? p.qualification_reasons : [];

  return (
    <article className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={selected} onChange={onToggle} className="mt-1" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-medium text-white">{p.business_name}</h3>
              <p className="text-sm text-gray-500">
                {p.industry ?? 'Business'} · {locationLabel(p)}
              </p>
              <a
                href={p.website.startsWith('http') ? p.website : `https://${p.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-sm text-violet-400 hover:text-violet-300"
              >
                {p.website}
              </a>
            </div>
            <div className="flex flex-wrap gap-2 text-right">
              <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 px-3 py-2">
                <p className="text-[10px] uppercase text-gray-500">Opportunity</p>
                <p className="text-lg font-semibold text-violet-300">{opportunityScoreLabel(p)}</p>
              </div>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                <p className="text-[10px] uppercase text-gray-500">Security</p>
                <p className="text-lg font-semibold text-amber-200">{securityScoreLabel(p)}</p>
              </div>
              {planFit && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
                  <p className="text-[10px] uppercase text-gray-500">Plan fit</p>
                  <p className="text-lg font-semibold text-emerald-300">{planFit}</p>
                </div>
              )}
            </div>
          </div>

          {p.selection_reason && (
            <p className="mt-3 text-sm leading-relaxed text-gray-300">
              <span className="font-medium text-gray-400">Why selected: </span>
              {p.selection_reason}
            </p>
          )}

          {reasons.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {reasons.map((r) => (
                <li
                  key={r}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-xs text-gray-400"
                >
                  {r}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5">
            <ContactBadge ok={p.contact_page_found} label="Contact page" />
            <ContactBadge ok={p.contact_email_found} label="Email" />
            <ContactBadge ok={p.contact_phone_found} label="Phone" />
            <ContactBadge ok={p.contact_linkedin_found} label="LinkedIn" />
          </div>

          <p className="mt-3 text-sm text-gray-500">
            <span className="text-gray-400">Next step:</span> {nextStep}
          </p>

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

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onGenerateOutreach}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500"
            >
              Generate outreach
            </button>
            <button
              type="button"
              onClick={() => setShowContact((v) => !v)}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:border-violet-500/50"
            >
              Contact info
            </button>
            <button
              type="button"
              onClick={onScan}
              disabled={scanning}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:border-violet-500/50 disabled:opacity-50"
            >
              {scanning ? 'Scanning…' : p.scan_status === 'completed' ? 'Re-scan' : 'Run scan'}
            </button>
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
                className="text-xs text-gray-500 hover:text-gray-300"
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
