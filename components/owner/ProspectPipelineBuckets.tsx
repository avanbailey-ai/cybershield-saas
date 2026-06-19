'use client';

import { useMemo, useState } from 'react';
import type { OwnerProspect } from '@/lib/owner/types';
import {
  classifyProspectsByQueue,
  QUEUE_LABELS,
  type PrimaryQueue,
} from '@/lib/owner/pipelineGate';
import { filterProspectsByKind, type ProspectKindView } from '@/lib/owner/prospectDisplay';
import ProspectCard from './ProspectCard';

const QUEUE_ORDER: PrimaryQueue[] = [
  'send_queue',
  'form_queue',
  'needs_contact',
  'manual_review',
  'rejected_not_icp',
  'not_urgent',
];

const QUEUE_TONE: Record<PrimaryQueue, string> = {
  send_queue: 'text-emerald-400 border-emerald-500/30',
  form_queue: 'text-violet-300 border-violet-500/30',
  needs_contact: 'text-amber-300 border-amber-500/30',
  manual_review: 'text-orange-300 border-orange-500/30',
  rejected_not_icp: 'text-red-300 border-red-500/30',
  not_urgent: 'text-gray-400 border-gray-600/30',
};

export default function ProspectPipelineBuckets({
  prospects,
  kindView = 'smb',
  onProspectsChange,
  onScan,
  onGenerateOutreach,
  onFindContact,
  onArchive,
  onIgnoreForever,
  onUnarchive,
  onDelete,
}: {
  prospects: OwnerProspect[];
  kindView?: ProspectKindView;
  onProspectsChange: (next: OwnerProspect[]) => void;
  onScan: (id: string) => Promise<void>;
  onGenerateOutreach: (id: string) => Promise<void>;
  onFindContact: (id: string) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onIgnoreForever: (id: string) => Promise<void>;
  onUnarchive: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [activeQueue, setActiveQueue] = useState<PrimaryQueue>('send_queue');
  const [scanning, setScanning] = useState<string | null>(null);

  const scoped = useMemo(
    () => filterProspectsByKind(prospects, kindView),
    [prospects, kindView],
  );

  const buckets = useMemo(() => classifyProspectsByQueue(scoped), [scoped]);

  const counts = useMemo(() => {
    const c = {} as Record<PrimaryQueue, number>;
    for (const q of QUEUE_ORDER) c[q] = buckets[q].length;
    return c;
  }, [buckets]);

  const visible = buckets[activeQueue];

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Pipeline queues — buyer-fit gated
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Each prospect resolves to one primary queue. Send Queue requires verified email + buyer fit.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {QUEUE_ORDER.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setActiveQueue(q)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              activeQueue === q
                ? `${QUEUE_TONE[q]} bg-white/[0.06]`
                : 'border-white/10 text-gray-500 hover:border-white/20'
            }`}
          >
            {QUEUE_LABELS[q]} ({counts[q]})
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-gray-500">
          No prospects in {QUEUE_LABELS[activeQueue]}.
          {activeQueue === 'send_queue' && counts.form_queue + counts.needs_contact > 0 && (
            <p className="mt-2 text-amber-300/90">
              No send-ready leads yet. You have {counts.form_queue + counts.needs_contact} weak-score
              website{counts.form_queue + counts.needs_contact === 1 ? '' : 's'} that need contact
              enrichment or manual review.
            </p>
          )}
        </div>
      ) : (
        <ul className="space-y-4">
          {visible.slice(0, 12).map((p) => (
            <li key={p.id}>
              <ProspectCard
                prospect={p}
                selected={false}
                scanning={scanning === p.id}
                onToggle={() => {}}
                onScan={async () => {
                  setScanning(p.id);
                  try {
                    await onScan(p.id);
                  } finally {
                    setScanning(null);
                  }
                }}
                onGenerateOutreach={() => onGenerateOutreach(p.id)}
                onFindContact={() => onFindContact(p.id)}
                onArchive={() => onArchive(p.id)}
                onIgnoreForever={() => onIgnoreForever(p.id)}
                onUnarchive={() => onUnarchive(p.id)}
                onDelete={() => onDelete(p.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
