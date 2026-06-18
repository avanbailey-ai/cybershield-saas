'use client';

import { useState } from 'react';
import { SectionCard } from './MetricCard';
import HygieneControls from './HygieneControls';
import type { OwnerContentPost } from '@/lib/owner/types';

export default function ContentPerformance({
  initialPosts,
  embedded,
}: {
  initialPosts: OwnerContentPost[];
  embedded?: boolean;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [view, setView] = useState<'active' | 'archived'>('active');
  const [form, setForm] = useState({
    platform: 'linkedin',
    title: '',
    views: '0',
    leads_generated: '0',
    customers_acquired: '0',
  });

  async function addPost(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/owner/content-posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: form.platform,
        title: form.title,
        status: 'published',
        views: Number(form.views),
        leads_generated: Number(form.leads_generated),
        customers_acquired: Number(form.customers_acquired),
        published_at: new Date().toISOString(),
      }),
    });
    const data = await res.json();
    if (data.post) {
      setPosts((p) => [data.post, ...p]);
      setForm({ platform: 'linkedin', title: '', views: '0', leads_generated: '0', customers_acquired: '0' });
    }
  }

  async function hygienePost(id: string, body: Record<string, boolean>) {
    const res = await fetch(`/api/owner/content-posts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.post) setPosts((p) => p.map((x) => (x.id === id ? data.post : x)));
  }

  async function deletePost(id: string) {
    const res = await fetch(`/api/owner/content-posts/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) setPosts((p) => p.filter((x) => x.id !== id));
  }

  const visible = posts.filter((p) => (view === 'archived' ? p.archived_at : !p.archived_at));

  const totals = visible.reduce(
    (acc, p) => ({
      views: acc.views + p.views,
      leads: acc.leads + p.leads_generated,
      customers: acc.customers + p.customers_acquired,
    }),
    { views: 0, leads: 0, customers: 0 },
  );

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
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-4 text-center">
          <p className="text-xs text-gray-500">Total Views</p>
          <p className="text-2xl font-bold text-white">{totals.views.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-4 text-center">
          <p className="text-xs text-gray-500">Leads Generated</p>
          <p className="text-2xl font-bold text-violet-400">{totals.leads}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-4 text-center">
          <p className="text-xs text-gray-500">Customers Acquired</p>
          <p className="text-2xl font-bold text-emerald-400">{totals.customers}</p>
        </div>
      </div>

      <form onSubmit={addPost} className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <select
          value={form.platform}
          onChange={(e) => setForm({ ...form, platform: e.target.value })}
          className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
        >
          <option value="linkedin">LinkedIn</option>
          <option value="facebook">Facebook</option>
          <option value="x">X</option>
          <option value="tiktok">TikTok</option>
          <option value="youtube">YouTube</option>
        </select>
        <input
          placeholder="Post title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white lg:col-span-2"
        />
        <input
          placeholder="Views"
          value={form.views}
          onChange={(e) => setForm({ ...form, views: e.target.value })}
          className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
        />
        <input
          placeholder="Leads"
          value={form.leads_generated}
          onChange={(e) => setForm({ ...form, leads_generated: e.target.value })}
          className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
        />
        <button
          type="submit"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
        >
          Log Post
        </button>
      </form>

      {visible.length === 0 ? (
        <p className="text-sm text-gray-500">No content tracked yet. Log your first post above.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs uppercase text-gray-500">
                <th className="pb-3 pr-4">Platform</th>
                <th className="pb-3 pr-4">Title</th>
                <th className="pb-3 pr-4">Views</th>
                <th className="pb-3 pr-4">Leads</th>
                <th className="pb-3 pr-4">Customers</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id} className="border-b border-gray-800/50">
                  <td className="py-3 pr-4 capitalize text-gray-400">{p.platform}</td>
                  <td className="py-3 pr-4 text-white">{p.title ?? '—'}</td>
                  <td className="py-3 pr-4 text-white">{p.views}</td>
                  <td className="py-3 pr-4 text-violet-400">{p.leads_generated}</td>
                  <td className="py-3 pr-4 text-emerald-400">{p.customers_acquired}</td>
                  <td className="py-3">
                    <HygieneControls
                      compact
                      archived={!!p.archived_at}
                      onArchive={() => hygienePost(p.id, { archive: true })}
                      onUnarchive={() => hygienePost(p.id, { unarchive: true })}
                      onDelete={() => deletePost(p.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  if (embedded) return <div id="content-performance">{inner}</div>;

  return (
    <SectionCard id="content-performance" title="Content" subtitle="Post performance">
      {inner}
    </SectionCard>
  );
}
