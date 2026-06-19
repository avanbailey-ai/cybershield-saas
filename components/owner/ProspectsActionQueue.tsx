'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import OutreachApprovalCard from './OutreachApprovalCard';
import type { OwnerOutreachDraft, OwnerProspect } from '@/lib/owner/types';
import {
  effectiveOutreachEmail,
  resolveProspectList,
  prospectMatchesKind,
  displayContactPhone,
  type ProspectKindView,
} from '@/lib/owner/prospectDisplay';
import { isEmailSendEligible } from '@/lib/owner/icpGate';
import { isDraftBlocked, draftBlockReason } from '@/lib/owner/pipelineGate';

export default function ProspectsActionQueue({
  prospects,
  onProspectsChange,
  kindView = 'smb',
}: {
  prospects: OwnerProspect[];
  onProspectsChange: (next: OwnerProspect[]) => void;
  kindView?: ProspectKindView;
}) {
  const [drafts, setDrafts] = useState<OwnerOutreachDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [findingContact, setFindingContact] = useState<string | null>(null);
  const autoContactRan = useRef(false);

  const refreshDrafts = useCallback(async () => {
    const res = await fetch('/api/owner/outreach/drafts?view=active');
    const data = await res.json();
    if (data.drafts) {
      setDrafts(
        (data.drafts as OwnerOutreachDraft[]).filter(
          (d) => d.status === 'draft' || d.status === 'approved',
        ),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refreshDrafts();
  }, [refreshDrafts, prospects]);

  const prospectMap = useMemo(() => {
    const map = new Map<string, OwnerProspect>();
    for (const p of resolveProspectList(prospects)) map.set(p.id, p);
    return map;
  }, [prospects]);

  const queue = useMemo(() => {
    return drafts
      .map((draft) => {
        const prospect = draft.prospect_id ? prospectMap.get(draft.prospect_id) : null;
        return prospect ? { draft, prospect } : null;
      })
      .filter((x): x is { draft: OwnerOutreachDraft; prospect: OwnerProspect } => x !== null)
      .filter(({ prospect }) => prospectMatchesKind(prospect, kindView));
  }, [drafts, prospectMap, kindView]);

  const sendable = useMemo(
    () =>
      queue.filter(
        ({ draft, prospect }) =>
          !isDraftBlocked(prospect, draft) &&
          isEmailSendEligible(prospect) &&
          Boolean(effectiveOutreachEmail(prospect, draft.recipient_email)),
      ),
    [queue],
  );

  const blocked = useMemo(
    () => queue.filter(({ draft, prospect }) => isDraftBlocked(prospect, draft)),
    [queue],
  );

  const runContactDiscovery = useCallback(
    async (prospectId: string) => {
      setFindingContact(prospectId);
      try {
        await fetch(`/api/owner/prospects/${prospectId}/contact`, { method: 'POST' });
        const res = await fetch('/api/owner/prospects');
        const data = await res.json();
        if (data.prospects) onProspectsChange(resolveProspectList(data.prospects));
        await refreshDrafts();
      } finally {
        setFindingContact(null);
      }
    },
    [onProspectsChange, refreshDrafts],
  );

  useEffect(() => {
    if (autoContactRan.current || loading || sendable.length > 0) return;
    const needsEmail = queue.filter(
      ({ draft, prospect }) =>
        !isDraftBlocked(prospect, draft) && !effectiveOutreachEmail(prospect, draft.recipient_email),
    );
    if (needsEmail.length === 0) return;
    autoContactRan.current = true;
    void (async () => {
      for (const { prospect } of needsEmail.slice(0, 3)) {
        await runContactDiscovery(prospect.id);
      }
    })();
  }, [loading, queue, sendable.length, runContactDiscovery]);

  async function sendDraft(draftId: string, prospectId: string) {
    const res = await fetch(`/api/owner/outreach/${draftId}/send`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      window.alert(data.error ?? 'Send failed');
      return;
    }
    onProspectsChange(
      prospects.map((p) => (p.id === prospectId ? { ...p, pipeline_state: 'contacted' } : p)),
    );
    await refreshDrafts();
  }

  async function editDraft(draftId: string, content: string) {
    await fetch(`/api/owner/outreach/${draftId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    await refreshDrafts();
  }

  async function regenerateDraft(draftId: string) {
    const res = await fetch(`/api/owner/outreach/${draftId}/regenerate`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) window.alert(data.error ?? 'Regenerate failed');
    await refreshDrafts();
  }

  async function patchProspect(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/owner/prospects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.prospect) {
      onProspectsChange(prospects.map((p) => (p.id === id ? data.prospect : p)));
    }
  }

  if (loading) return null;

  if (queue.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
        <p className="text-sm font-medium text-gray-400">Nothing ready to send yet</p>
        <p className="mt-2 text-xs text-gray-600">
          Email-ready private-business leads with buyer-fit approval appear here. Contact-form and
          manual-review leads stay in their own queues.
        </p>
      </section>
    );
  }

  return (
    <section id="prospects-send-queue" className="space-y-6">
      {blocked.length > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-red-300">
            Drafts blocked ({blocked.length})
          </p>
          <ul className="mt-3 space-y-2 text-sm text-red-100/90">
            {blocked.map(({ draft, prospect }) => (
              <li key={draft.id}>
                <span className="font-medium text-white">{prospect.business_name}</span>
                <span className="text-red-200/80"> — {draftBlockReason(prospect, draft)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sendable.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-amber-500/20 bg-amber-500/5 p-8 text-center">
          <p className="text-sm font-medium text-amber-200">No send-ready drafts</p>
          <p className="mt-2 text-xs text-amber-200/70">
            {blocked.length > 0
              ? 'Existing drafts failed buyer-fit/contact rules and were removed from Send Queue.'
              : 'Drafts need a verified email and buyer-fit clearance before approval.'}
          </p>
        </div>
      ) : (
        <>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Send queue</p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              {sendable.length} draft{sendable.length === 1 ? '' : 's'} ready — approval required
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Buyer-fit passed · verified email · weak scan findings. Not sent until you approve.
            </p>
          </div>
          <ul className="space-y-5">
            {sendable.map(({ draft, prospect }) => {
              const email = effectiveOutreachEmail(prospect, draft.recipient_email)!;
              const prospectForCard = { ...prospect, contact_email: email };

              return (
                <li key={draft.id} id={prospect.id ? `prospect-${prospect.id}` : undefined}>
                  <OutreachApprovalCard
                    prospect={prospectForCard}
                    draft={draft}
                    onApproveSend={() => sendDraft(draft.id, prospect.id)}
                    onEditDraft={(content) => editDraft(draft.id, content)}
                    onRegenerate={() => regenerateDraft(draft.id)}
                    onArchive={() => patchProspect(prospect.id, { archive: true })}
                    onIgnoreForever={() => patchProspect(prospect.id, { ignore_forever: true })}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
