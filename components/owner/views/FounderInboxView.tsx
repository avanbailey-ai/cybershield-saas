'use client';

import { useCallback, useMemo, useState } from 'react';
import { FounderInboxList } from '../AutopilotCommandCenter';
import type { FounderOsV6Data } from '@/lib/owner/founderOsV6';
import type { FounderInboxItem } from '@/lib/owner/founderOsV5';

const INBOX_GROUPS: { id: string; label: string; types: FounderInboxItem['type'][] }[] = [
  { id: 'outreach', label: 'Approve outreach', types: ['outreach', 'follow_up'] },
  { id: 'risk', label: 'Customer risk', types: ['customer_risk'] },
  { id: 'expansion', label: 'Approve upgrades', types: ['expansion'] },
  { id: 'signups', label: 'Review signups', types: ['signup'] },
];

export default function FounderInboxView({ initial }: { initial: FounderOsV6Data }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const refresh = useCallback(async () => {
    const res = await fetch('/api/owner/founder-os');
    const json = await res.json();
    if (json.data) setData(json.data);
  }, []);

  async function approve(id: string, meta?: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch('/api/owner/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', ids: [id], meta }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    if (filter === 'all') return data.inbox;
    const group = INBOX_GROUPS.find((g) => g.id === filter);
    if (!group) return data.inbox;
    return data.inbox.filter((i) => group.types.includes(i.type));
  }, [data.inbox, filter]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: data.inbox.length };
    for (const g of INBOX_GROUPS) {
      map[g.id] = data.inbox.filter((i) => g.types.includes(i.type)).length;
    }
    return map;
  }, [data.inbox]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Founder inbox</h1>
        <p className="mt-2 text-gray-500">
          Approve outreach, review risk, and act on upgrades — each action executes automation.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <FilterChip
          active={filter === 'all'}
          label={`All (${counts.all})`}
          onClick={() => setFilter('all')}
        />
        {INBOX_GROUPS.map((g) => (
          <FilterChip
            key={g.id}
            active={filter === g.id}
            label={`${g.label} (${counts[g.id]})`}
            onClick={() => setFilter(g.id)}
          />
        ))}
      </div>

      {data.v6.revenueAtRisk.totalMrrAtRisk > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/90">
          ${data.v6.revenueAtRisk.totalMrrAtRisk}/mo at risk across{' '}
          {data.v6.revenueAtRisk.affectedCustomers.length} account(s). Approving retention items
          queues outreach.
        </div>
      )}

      <FounderInboxList
        items={filtered}
        onApprove={(id) => {
          const item = data.inbox.find((i) => i.id === id);
          approve(id, item?.meta);
        }}
        busy={busy}
      />
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs ${
        active
          ? 'border-violet-500/50 bg-violet-500/10 text-violet-300'
          : 'border-white/10 text-gray-400 hover:border-white/20'
      }`}
    >
      {label}
    </button>
  );
}
