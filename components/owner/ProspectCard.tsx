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
import { hasOutreachContact, isAgencyKind, isTrulyOutreachReady } from '@/lib/owner/prospectDisplay';
import { agencyTypeLabel } from '@/lib/owner/agency/agencyTypes';
import { AGENCY_PLAN_PRICE } from '@/lib/owner/agency/agencyScore';
import { rejectionReasonLabel } from '@/lib/owner/prospectQualityBrain';
import type { OwnerProspect } from '@/lib/owner/types';

const SERVICE_LABELS: Record<string, string> = {
  wordpress: 'WordPress',
  shopify: 'Shopify',
  webflow: 'Webflow',
  wix: 'Wix',
  squarespace: 'Squarespace',
  woocommerce: 'WooCommerce',
  seo: 'SEO',
  hosting: 'Hosting',
  maintenance: 'Maintenance',
  care_plan: 'Care plans',
  security: 'Security',
  managed_sites: 'Managed sites',
  digital_marketing: 'Digital marketing',
  branding: 'Branding',
  ecommerce: 'Ecommerce',
};

function qualityLabelStyle(label: string | null | undefined): string {
  switch (label) {
    case 'HOT':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
    case 'WARM':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
    case 'LOW':
      return 'border-gray-600/40 bg-white/[0.03] text-gray-300';
    case 'NEEDS REVIEW':
      return 'border-orange-500/40 bg-orange-500/10 text-orange-200';
    case 'REJECTED':
      return 'border-red-500/30 bg-red-500/5 text-red-300';
    default:
      return 'border-white/10 bg-white/[0.02] text-gray-400';
  }
}

function contactConfidenceLabel(confidence: string | null | undefined): string {
  const map: Record<string, string> = {
    verified_public_email: 'Verified public email',
    likely_business_email: 'Likely business email',
    generic_public_inbox: 'Generic public inbox',
    personal_public_contact: 'Personal (published)',
    unverified_guess: 'Unverified guess',
    no_contact: 'No contact',
  };
  return confidence ? (map[confidence] ?? confidence) : '—';
}

function agencyLabelStyle(label: string | null | undefined): string {
  switch (label) {
    case 'AGENCY HOT':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
    case 'AGENCY WARM':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
    case 'AGENCY LOW':
      return 'border-gray-600/40 bg-white/[0.03] text-gray-300';
    default:
      return 'border-red-500/30 bg-red-500/5 text-red-300';
  }
}

interface Props {
  prospect: OwnerProspect;
  selected: boolean;
  scanning: boolean;
  onToggle: () => void;
  onScan: () => void;
  onGenerateOutreach: () => void;
  onFindContact: () => void;
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
  onFindContact,
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
  const canGenerateOutreach = isTrulyOutreachReady(p);
  const isAgency = isAgencyKind(p);
  const detectedServices = Array.isArray(p.detected_services) ? p.detected_services : [];

  return (
    <article className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={selected} onChange={onToggle} className="mt-1.5" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-xl font-semibold tracking-tight text-white">{p.business_name}</h3>
              <p className="mt-1 text-sm text-gray-400">
                {isAgency ? agencyTypeLabel(p.agency_type) : p.industry ?? 'Business'} ·{' '}
                {locationLabel(p)}
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
              {p.quality_label && (
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${qualityLabelStyle(
                    p.quality_label,
                  )}`}
                >
                  {p.quality_label}
                </span>
              )}
              {isAgency ? (
                <ScorePill
                  label="Agency Score"
                  value={
                    p.agency_opportunity_score != null ? `${p.agency_opportunity_score}/100` : '—'
                  }
                  accent="violet"
                />
              ) : (
                <ScorePill label="Opportunity" value={opportunityScoreLabel(p)} accent="violet" />
              )}
              <ScorePill label="Security" value={securityScoreLabel(p)} accent="amber" />
            </div>
          </div>

          {isAgency && (
            <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${agencyLabelStyle(
                    p.agency_label,
                  )}`}
                >
                  {p.agency_label ?? 'AGENCY'}
                </span>
                <span className="text-xs text-gray-400">{agencyTypeLabel(p.agency_type)}</span>
                {p.manages_client_sites && (
                  <span className="text-xs text-emerald-300">Manages client sites</span>
                )}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                  <p className="text-[10px] uppercase text-gray-500">Client-site potential</p>
                  <p className="text-sm font-medium text-white">
                    {p.estimated_site_count != null ? `~${p.estimated_site_count} sites` : 'Unknown'}
                  </p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                  <p className="text-[10px] uppercase text-gray-500">Suggested plan</p>
                  <p className="text-sm font-medium text-emerald-300">Agency (${AGENCY_PLAN_PRICE}/mo)</p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                  <p className="text-[10px] uppercase text-gray-500">Revenue potential</p>
                  <p className="text-sm font-medium text-white">
                    ${AGENCY_PLAN_PRICE}/mo · ${AGENCY_PLAN_PRICE * 12}/yr
                  </p>
                </div>
              </div>

              {detectedServices.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] uppercase text-gray-500">Detected services</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {detectedServices.map((s) => (
                      <span
                        key={s}
                        className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-xs text-gray-300"
                      >
                        {SERVICE_LABELS[s] ?? s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {p.agency_why_selected && (
                <p className="mt-3 text-xs text-gray-400">{p.agency_why_selected}</p>
              )}
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {planFit && (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <p className="text-[10px] uppercase text-gray-500">Plan fit</p>
                <p className="text-sm font-medium text-emerald-300">{planFit}</p>
              </div>
            )}
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <p className="text-[10px] uppercase text-gray-500">Fit score</p>
              <p className="text-sm font-medium text-white">{opportunityScoreLabel(p)}</p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <p className="text-[10px] uppercase text-gray-500">Contact confidence</p>
              <p className="text-sm font-medium text-white">{contactConfidenceLabel(p.contact_confidence)}</p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <p className="text-[10px] uppercase text-gray-500">Est. MRR</p>
              <p className="text-sm font-medium text-white">
                {p.estimated_mrr ? `$${p.estimated_mrr}/mo` : '—'}
              </p>
            </div>
          </div>

          {(p.buying_trigger || p.why_now || p.selection_reason) && (
            <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-gray-300">
              {p.selection_reason && (
                <p>
                  <span className="font-medium text-gray-400">Why selected: </span>
                  {p.selection_reason}
                </p>
              )}
              {p.buying_trigger && (
                <p className="mt-2">
                  <span className="font-medium text-gray-400">Buying trigger: </span>
                  {p.buying_trigger}
                </p>
              )}
              {p.why_now && (
                <p className="mt-2">
                  <span className="font-medium text-gray-400">Why now: </span>
                  {p.why_now}
                </p>
              )}
            </div>
          )}

          {p.rejection_reason && (
            <p className="mt-3 text-xs text-red-300">
              Rejected: {rejectionReasonLabel(p.rejection_reason)}
            </p>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <p className="text-[10px] uppercase text-gray-500">Conversion confidence</p>
              <p className="text-sm font-medium text-white">{confidence}</p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <p className="text-[10px] uppercase text-gray-500">Next action</p>
              <p className="text-sm font-medium text-violet-300">{nextStep}</p>
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
            {canGenerateOutreach ? (
              <button
                type="button"
                onClick={onGenerateOutreach}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
              >
                {isAgency ? 'Generate agency draft' : 'Generate outreach'}
              </button>
            ) : action.action === 'contact' && p.scan_status === 'completed' ? (
              <button
                type="button"
                onClick={onFindContact}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
              >
                Find email on website
              </button>
            ) : (
              <button
                type="button"
                onClick={onGenerateOutreach}
                disabled
                title="Complete scan and find an email first"
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white opacity-40"
              >
                Generate outreach
              </button>
            )}
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
