'use client';

import { useState } from 'react';
import { SectionCard } from './MetricCard';
import type { OwnerContentPost } from '@/lib/owner/types';

export default function ContentPerformance({
  initialPosts,
}: {
  initialPosts: OwnerContentPost[];
}) {
  const [posts, setPosts] = useState(initialPosts);
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

  const totals = posts.reduce(
    (acc, p) => ({
      views: acc.views + p.views,
      leads: acc.leads + p.leads_generated,
      customers: acc.customers + p.customers_acquired,
    }),
    { views: 0, leads: 0, customers: 0 },
  );

  return (
    <SectionCard
      id="content-performance"
      title="Content Performance"
      subtitle="Track posts, views, leads, and customers by platform"
    >
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

      {posts.length === 0 ? (
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
                <th className="pb-3">Customers</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className="border-b border-gray-800/50">
                  <td className="py-3 pr-4 capitalize text-gray-400">{p.platform}</td>
                  <td className="py-3 pr-4 text-white">{p.title ?? '—'}</td>
                  <td className="py-3 pr-4 text-white">{p.views}</td>
                  <td className="py-3 pr-4 text-violet-400">{p.leads_generated}</td>
                  <td className="py-3 text-emerald-400">{p.customers_acquired}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
