'use client';

import { useState } from 'react';
import { FounderInboxList } from '../AutopilotCommandCenter';
import { useFounderNav } from '../FounderNavContext';
import type { FounderInboxItem } from '@/lib/owner/founderOsV5';

export default function FounderInboxSection({
  items,
  totalCount,
}: {
  items: FounderInboxItem[];
  totalCount: number;
}) {
  const { refreshFounderData, setSection } = useFounderNav();
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  async function postInbox(action: 'approve' | 'dismiss', id: string, meta?: Record<string, unknown>) {
    setBusy(true);
    setLastError(null);
    try {
      const res = await fetch('/api/owner/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids: [id], meta }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) {
        const failed = (json.results as { ok?: boolean; detail?: string }[] | undefined)?.find(
          (r) => r.ok === false,
        );
        setLastError(
          failed?.detail ??
            (typeof json.error === 'string' ? json.error : 'Inbox action failed.'),
        );
        return;
      }
      await refreshFounderData();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border-2 border-violet-500/25 bg-violet-950/20 p-6 shadow-inner">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Founder inbox</h2>
          <p className="mt-1 text-sm text-gray-400">
            Actionable approvals only — each sends email or executes automation via Resend
          </p>
        </div>
        {totalCount > items.length && (
          <button
            type="button"
            onClick={() => setSection('inbox')}
            className="shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
          >
            Full inbox ({totalCount})
          </button>
        )}
      </div>
      {lastError && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {lastError}
        </div>
      )}
      <div className="mt-5">
        <FounderInboxList
          items={items}
          onApprove={(id) => {
            const item = items.find((i) => i.id === id);
            postInbox('approve', id, item?.meta);
          }}
          onDismiss={(id) => postInbox('dismiss', id)}
          busy={busy}
        />
      </div>
    </section>
  );
}
