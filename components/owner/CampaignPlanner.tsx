'use client';

import { useState } from 'react';
import { SectionCard } from './MetricCard';
import HygieneControls from './HygieneControls';
import type { OwnerCampaign, OwnerCampaignTask } from '@/lib/owner/types';

type CampaignWithTasks = OwnerCampaign & { owner_campaign_tasks: OwnerCampaignTask[] };

function todayTask(camp: CampaignWithTasks): OwnerCampaignTask | null {
  if (!camp.start_date) return camp.owner_campaign_tasks?.[0] ?? null;
  const start = new Date(camp.start_date);
  const dayOffset = Math.floor((Date.now() - start.getTime()) / 86400000);
  const tasks = [...(camp.owner_campaign_tasks ?? [])].sort((a, b) => a.day_offset - b.day_offset);
  return tasks.find((t) => t.day_offset === dayOffset && !t.completed) ?? tasks.find((t) => !t.completed) ?? null;
}

export default function CampaignPlanner({
  initialCampaigns,
  embedded,
}: {
  initialCampaigns: CampaignWithTasks[];
  embedded?: boolean;
}) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [view, setView] = useState<'active' | 'archived'>('active');
  const [name, setName] = useState('');
  const [duration, setDuration] = useState<7 | 30>(7);
  const [loading, setLoading] = useState(false);

  async function createCampaign() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/owner/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, duration_days: duration, activate: true }),
      });
      const data = await res.json();
      if (data.campaign) setCampaigns((c) => [data.campaign, ...c]);
      setName('');
    } finally {
      setLoading(false);
    }
  }

  async function toggleTask(campaignId: string, taskId: string, completed: boolean) {
    const res = await fetch(`/api/owner/campaigns/${campaignId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, completed: !completed }),
    });
    const data = await res.json();
    if (data.campaign) {
      setCampaigns((c) => c.map((x) => (x.id === campaignId ? data.campaign : x)));
    }
  }

  async function hygieneCampaign(id: string, body: Record<string, boolean>) {
    const res = await fetch(`/api/owner/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.campaign) setCampaigns((c) => c.map((x) => (x.id === id ? data.campaign : x)));
  }

  async function deleteCampaign(id: string) {
    const res = await fetch(`/api/owner/campaigns/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) setCampaigns((c) => c.filter((x) => x.id !== id));
  }

  const visible = campaigns.filter((c) => (view === 'archived' ? c.archived_at : !c.archived_at));
  const activeCampaign = visible.find((c) => c.status === 'active') ?? visible[0];

  const today = activeCampaign ? todayTask(activeCampaign) : null;

  const inner = (
    <>
      <div className="mb-4 flex gap-2">
        {(['active', 'archived'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded-lg px-3 py-1 text-xs ${
              view === v ? 'bg-violet-600 text-white' : 'text-gray-400'
            }`}
          >
            {v === 'active' ? 'Active' : 'Archived'}
          </button>
        ))}
      </div>
      {today && (
        <div className="mb-6 rounded-xl border border-violet-500/30 bg-violet-500/10 p-4">
          <p className="text-xs font-medium uppercase text-violet-400">Today&apos;s Goal</p>
          <p className="mt-1 font-medium text-white">{today.title}</p>
          <p className="text-xs text-gray-500">Campaign: {activeCampaign?.name}</p>
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Campaign name"
          className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
        />
        <select
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value) as 7 | 30)}
          className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
        >
          <option value={7}>7-day plan</option>
          <option value={30}>30-day plan</option>
        </select>
        <button
          type="button"
          onClick={createCampaign}
          disabled={loading}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          Launch Campaign
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-700 p-6 text-center">
          <p className="text-sm text-gray-500">No campaigns yet. Launch a 7-day growth sprint.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((camp) => {
            const tasks = camp.owner_campaign_tasks ?? [];
            const done = tasks.filter((t) => t.completed).length;
            const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
            return (
              <div key={camp.id} className="rounded-xl border border-gray-800 bg-gray-950/50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-white">{camp.name}</h3>
                    <p className="text-xs text-gray-500">
                      {camp.duration_days}-day · {camp.status} · {done}/{tasks.length} complete ({pct}%)
                    </p>
                  </div>
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-800">
                    <div
                      className="h-full rounded-full bg-violet-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <HygieneControls
                    compact
                    archived={!!camp.archived_at}
                    onArchive={() => hygieneCampaign(camp.id, { archive: true })}
                    onUnarchive={() => hygieneCampaign(camp.id, { unarchive: true })}
                    onDelete={() => deleteCampaign(camp.id)}
                  />
                </div>
                <ul className="space-y-2">
                  {tasks
                    .sort((a, b) => a.day_offset - b.day_offset)
                    .map((task) => (
                      <li key={task.id} className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => toggleTask(camp.id, task.id, task.completed)}
                          className="h-4 w-4 rounded border-gray-600"
                        />
                        <span
                          className={`text-sm ${task.completed ? 'text-gray-500 line-through' : 'text-gray-300'}`}
                        >
                          Day {task.day_offset + 1}: {task.title}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  if (embedded) return <div id="campaigns">{inner}</div>;

  return (
    <SectionCard id="campaigns" title="Campaigns" subtitle="Daily outreach tasks">
      {inner}
    </SectionCard>
  );
}
