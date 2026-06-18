'use client';

import { useCallback, useState } from 'react';
import { FounderInboxList } from '../AutopilotCommandCenter';
import type { FounderOsV5Data } from '@/lib/owner/founderOsV5';

export default function FounderInboxView({ initial }: { initial: FounderOsV5Data }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/owner/founder-os');
    const json = await res.json();
    if (json.data) setData(json.data);
  }, []);

  async function approve(id: string) {
    setBusy(true);
    try {
      await fetch('/api/owner/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', ids: [id] }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Founder inbox</h1>
        <p className="mt-2 text-gray-500">
          Everything that needs your approval — nothing else.
        </p>
      </header>
      <FounderInboxList items={data.inbox} onApprove={approve} busy={busy} />
    </div>
  );
}
