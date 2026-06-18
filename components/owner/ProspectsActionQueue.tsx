'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import OutreachApprovalCard from './OutreachApprovalCard';
import type { OwnerOutreachDraft, OwnerProspect } from '@/lib/owner/types';
import { hasOutreachContact, resolveProspectList } from '@/lib/owner/prospectDisplay';

export default function ProspectsActionQueue({
  prospects,
  onProspectsChange,
}: {
  prospects: OwnerProspect[];
  onProspectsChange: (next: OwnerProspect[]) => void;
}) {
  const [drafts, setDrafts] = useState<OwnerOutreachDraft[]>([]);
  const [loading, setLoading] = useState(true);

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
      .filter((x): x is { draft: OwnerOutreachDraft; prospect: OwnerProspect } => x !== null);
  }, [drafts, prospectMap]);

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
        <p className="text-sm font-medium text-gray-400">No emails in the send queue</p>
        <p className="mt-2 text-xs text-gray-600">
          Generate outreach from qualified prospects with contact info, or approve drafts from Inbox.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            Send queue
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            {queue.length} email{queue.length === 1 ? '' : 's'} ready — approve to send via Resend
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            These drafts are waiting for your approval. Sending moves prospects to Contacted and
            schedules follow-ups.
          </p>
        </div>
      </div>
      <ul className="space-y-5">
        {queue.map(({ draft, prospect }) => (
          <li key={draft.id}>
            {hasOutreachContact(prospect) ? (
              <OutreachApprovalCard
                prospect={prospect}
                draft={draft}
                onApproveSend={() => sendDraft(draft.id, prospect.id)}
                onEditDraft={(content) => editDraft(draft.id, content)}
                onRegenerate={() => regenerateDraft(draft.id)}
                onArchive={() => patchProspect(prospect.id, { archive: true })}
                onIgnoreForever={() => patchProspect(prospect.id, { ignore_forever: true })}
              />
            ) : (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 text-sm text-amber-200">
                {prospect.business_name}: draft exists but contact email missing —{' '}
                <button
                  type="button"
                  className="text-violet-300 underline"
                  onClick={async () => {
                    await fetch(`/api/owner/prospects/${prospect.id}/contact`, { method: 'POST' });
                    const res = await fetch('/api/owner/prospects');
                    const data = await res.json();
                    if (data.prospects) onProspectsChange(data.prospects);
                  }}
                >
                  run contact discovery
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
