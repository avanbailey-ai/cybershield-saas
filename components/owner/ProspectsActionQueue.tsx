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
import { sensitiveSectorLabel } from '@/lib/owner/sensitiveSectorCaution';

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
    if (autoContactRan.current || loading || queue.length === 0) return;
    const blocked = queue.filter(
      ({ draft, prospect }) => !effectiveOutreachEmail(prospect, draft.recipient_email),
    );
    if (blocked.length === 0) return;
    autoContactRan.current = true;
    void (async () => {
      for (const { prospect } of blocked.slice(0, 3)) {
        await runContactDiscovery(prospect.id);
      }
    })();
  }, [loading, queue, runContactDiscovery]);

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
          Prospects with an email and strong opportunity score appear here for approve-and-send.
        </p>
      </section>
    );
  }

  const sendable = queue.filter(({ draft, prospect }) =>
    Boolean(effectiveOutreachEmail(prospect, draft.recipient_email)),
  );

  return (
    <section id="prospects-send-queue" className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Send queue</p>
        <h2 className="mt-1 text-xl font-semibold text-white">
          {sendable.length > 0
            ? `${sendable.length} draft${sendable.length === 1 ? '' : 's'} ready — approval required`
            : `${queue.length} draft${queue.length === 1 ? '' : 's'} need an email first`}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Draft ready but not sent until you approve. Prospect moves to Contacted after send.
        </p>
      </div>
      <ul className="space-y-5">
        {queue.map(({ draft, prospect }) => {
          const email = effectiveOutreachEmail(prospect, draft.recipient_email);
          const prospectForCard = email
            ? { ...prospect, contact_email: email }
            : prospect;

          return (
            <li key={draft.id} id={prospect.id ? `prospect-${prospect.id}` : undefined}>
              {email ? (
                <OutreachApprovalCard
                  prospect={prospectForCard}
                  draft={draft}
                  onApproveSend={() => sendDraft(draft.id, prospect.id)}
                  onEditDraft={(content) => editDraft(draft.id, content)}
                  onRegenerate={() => regenerateDraft(draft.id)}
                  onArchive={() => patchProspect(prospect.id, { archive: true })}
                  onIgnoreForever={() => patchProspect(prospect.id, { ignore_forever: true })}
                />
              ) : (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 text-sm text-amber-100">
                  <p className="font-medium text-white">{prospect.business_name}</p>
                  <p className="mt-1 text-amber-200/90">
                    Outreach draft exists but no sendable email yet.
                    {displayContactPhone(prospect) ? ` Phone on file: ${displayContactPhone(prospect)}.` : ''}
                  </p>
                  <button
                    type="button"
                    className="mt-3 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                    disabled={findingContact === prospect.id}
                    onClick={() => runContactDiscovery(prospect.id)}
                  >
                    {findingContact === prospect.id ? 'Searching website…' : 'Find email on website'}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
