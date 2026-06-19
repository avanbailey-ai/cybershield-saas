'use client';

import { useState } from 'react';
import type { OwnerProspect, OwnerOutreachDraft } from '@/lib/owner/types';
import {
  opportunityScoreLabel,
  planFitLabel,
  securityScoreLabel,
  confidenceLabel,
} from '@/lib/owner/pipeline';
import { hasOutreachContact } from '@/lib/owner/prospectDisplay';
import { sensitiveSectorLabel } from '@/lib/owner/sensitiveSectorCaution';

interface Props {
  prospect: OwnerProspect;
  draft: OwnerOutreachDraft;
  onApproveSend: () => Promise<void>;
  onEditDraft: (content: string) => Promise<void>;
  onRegenerate: () => Promise<void>;
  onArchive: () => Promise<void>;
  onIgnoreForever: () => Promise<void>;
}

export default function OutreachApprovalCard({
  prospect,
  draft,
  onApproveSend,
  onEditDraft,
  onRegenerate,
  onArchive,
  onIgnoreForever,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(draft.content);
  const reasons = Array.isArray(prospect.qualification_reasons)
    ? prospect.qualification_reasons
    : [];
  const canSend = hasOutreachContact(prospect) && prospect.scan_status === 'completed';
  const sensitiveCaution = sensitiveSectorLabel(prospect);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  const subjectPreview = draft.content.match(/^Subject:\s*(.+?)(?:\n|$)/i)?.[1] ?? null;

  return (
    <article className="rounded-2xl border border-violet-500/20 bg-gradient-to-b from-violet-500/5 to-transparent p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-violet-300/80">
            Draft ready — approval required
          </p>
          <h3 className="mt-1 text-xl font-semibold text-white">{prospect.business_name}</h3>
          <a
            href={
              prospect.website.startsWith('http') ? prospect.website : `https://${prospect.website}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-violet-400 hover:text-violet-300"
          >
            {prospect.website}
          </a>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge label="Opportunity" value={opportunityScoreLabel(prospect)} />
          <Badge label="Security" value={securityScoreLabel(prospect)} />
          {planFitLabel(prospect) && <Badge label="Plan" value={planFitLabel(prospect)!} />}
        </div>
      </header>

      {sensitiveCaution && (
        <p className="mt-4 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-100">
          {sensitiveCaution}
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
          <p className="text-[10px] uppercase text-gray-500">Contact email</p>
          <p className="text-sm font-medium text-emerald-300">
            {prospect.contact_email ?? '—'}
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
          <p className="text-[10px] uppercase text-gray-500">Confidence</p>
          <p className="text-sm font-medium text-white">
            {confidenceLabel(prospect.conversion_likelihood, prospect.opportunity_score)}
          </p>
        </div>
      </div>

      {reasons.length > 0 && (
        <ul className="mt-4 space-y-1">
          {reasons.slice(0, 4).map((r) => (
            <li key={r} className="text-sm text-gray-300">
              ✓ {r}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 rounded-lg border border-white/[0.08] bg-black/30 p-4">
        <p className="text-xs uppercase text-gray-500">Email preview</p>
        {subjectPreview && (
          <p className="mt-2 text-sm font-medium text-white">Subject: {subjectPreview}</p>
        )}
        {editing ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={8}
            className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200"
          />
        ) : (
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-sm text-gray-300">
            {draft.content}
          </pre>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !canSend}
          onClick={() => run(onApproveSend)}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          Approve &amp; Send
        </button>
        {editing ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await onEditDraft(editContent);
                  setEditing(false);
                })
              }
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white"
            >
              Save draft
            </button>
            <button
              type="button"
              onClick={() => {
                setEditContent(draft.content);
                setEditing(false);
              }}
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => setEditing(true)}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300"
          >
            Edit draft
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => run(onRegenerate)}
          className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300"
        >
          Regenerate
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run(onArchive)}
          className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-400"
        >
          Archive
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run(onIgnoreForever)}
          className="text-sm text-gray-500 hover:text-gray-300"
        >
          Ignore forever
        </button>
      </div>
    </article>
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1 text-xs">
      <span className="text-gray-500">{label}: </span>
      <span className="text-white">{value}</span>
    </span>
  );
}
