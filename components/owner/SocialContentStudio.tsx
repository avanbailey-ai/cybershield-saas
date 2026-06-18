'use client';

import { useState } from 'react';
import { SectionCard } from './MetricCard';
import CopyButton from './CopyButton';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/lib/owner/generators/social';

export default function SocialContentStudio() {
  const [platform, setPlatform] = useState<SocialPlatform>('linkedin');
  const [topic, setTopic] = useState('Why continuous website security monitoring matters');
  const [audience, setAudience] = useState('small business owners');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch('/api/owner/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, topic, audience }),
      });
      const data = await res.json();
      if (data.content) setContent(data.content);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionCard
      id="social"
      title="Social Content Studio"
      subtitle="Generate platform-specific posts and scripts"
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
          className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
        >
          {SOCIAL_PLATFORMS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Topic"
          className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white lg:col-span-2"
        />
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {loading ? 'Generating…' : 'Generate Post'}
        </button>
      </div>

      {content && (
        <div className="relative rounded-xl border border-gray-800 bg-gray-950 p-4">
          <div className="absolute right-3 top-3">
            <CopyButton text={content} />
          </div>
          <pre className="whitespace-pre-wrap text-sm text-gray-300">{content}</pre>
        </div>
      )}
    </SectionCard>
  );
}
