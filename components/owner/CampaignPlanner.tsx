'use client';

import { useState } from 'react';
import { SectionCard } from './MetricCard';
import type { OwnerCampaign, OwnerCampaignTask } from '@/lib/owner/types';

type CampaignWithTasks = OwnerCampaign & { owner_campaign_tasks: OwnerCampaignTask[] };

export default function CampaignPlanner({
  initialCampaigns,
}: {
  initialCampaigns: CampaignWithTasks[];
}) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
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
        body: JSON.stringify({ name, duration_days: duration }),
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

  return (
    <SectionCard
      id="campaigns"
      title="Campaign Planner"
      subtitle="7-day and 30-day plans with task checklists"
    >
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
          Create Plan
        </button>
      </div>

      {campaigns.length === 0 ? (
        <p className="text-sm text-gray-500">No campaigns yet. Create your first growth plan.</p>
      ) : (
        <div className="space-y-4">
          {campaigns.map((camp) => {
            const tasks = camp.owner_campaign_tasks ?? [];
            const done = tasks.filter((t) => t.completed).length;
            return (
              <div key={camp.id} className="rounded-xl border border-gray-800 bg-gray-950/50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-white">{camp.name}</h3>
                    <p className="text-xs text-gray-500">
                      {camp.duration_days}-day plan · {done}/{tasks.length} complete
                    </p>
                  </div>
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-800">
                    <div
                      className="h-full rounded-full bg-violet-500 transition-all"
                      style={{
                        width: `${tasks.length ? (done / tasks.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
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
    </SectionCard>
  );
}
