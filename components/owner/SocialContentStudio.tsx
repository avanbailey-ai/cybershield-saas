'use client';

import { useState } from 'react';
import { SectionCard } from './MetricCard';
import CopyButton from './CopyButton';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/lib/owner/generators/social';
import type { ContentSuggestion } from '@/lib/owner/generators/contentIntel';

interface Props {
  suggestions: ContentSuggestion[];
}

export default function SocialContentStudio({ suggestions, embedded }: Props & { embedded?: boolean }) {
  const [platform, setPlatform] = useState<SocialPlatform>('linkedin');
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);

  async function generate(fromSuggestion?: ContentSuggestion) {
    setLoading(true);
    const useTopic = fromSuggestion?.title ?? topic ?? 'Website security insights from real scan data';
    try {
      const res = await fetch('/api/owner/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: fromSuggestion
            ? (fromSuggestion.platform.toLowerCase().includes('linkedin')
                ? 'linkedin'
                : fromSuggestion.platform.toLowerCase().includes('tiktok')
                  ? 'tiktok'
                  : fromSuggestion.platform.toLowerCase().includes('youtube')
                    ? 'youtube_shorts'
                    : 'x') as SocialPlatform
            : platform,
          topic: useTopic,
          audience: 'small business owners',
          keyPoints: fromSuggestion ? [fromSuggestion.hook, fromSuggestion.angle] : undefined,
        }),
      });
      const data = await res.json();
      if (data.content) setContent(data.content);
    } finally {
      setLoading(false);
    }
  }

  const inner = (
    <>
      {suggestions.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-medium text-white">This Week&apos;s Best Angles</h3>
          <div className="grid gap-3 lg:grid-cols-2">
            {suggestions.slice(0, 4).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSelectedSuggestion(s.id);
                  setTopic(s.title);
                  generate(s);
                }}
                className={`rounded-xl border p-4 text-left transition ${
                  selectedSuggestion === s.id
                    ? 'border-violet-500/50 bg-violet-500/10'
                    : 'border-gray-800 bg-gray-950/50 hover:border-violet-500/30'
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-[10px] uppercase text-violet-400">{s.platform}</span>
                  <span className="text-[10px] text-gray-600">{s.priority}</span>
                </div>
                <p className="text-sm font-medium text-white">{s.title}</p>
                <p className="mt-1 text-xs text-gray-500">{s.hook}</p>
              </button>
            ))}
          </div>
        </div>
      )}

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
          placeholder="Topic or select suggestion above"
          className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white lg:col-span-2"
        />
        <button
          type="button"
          onClick={() => generate()}
          disabled={loading}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {loading ? 'Generating…' : 'Generate Script'}
        </button>
      </div>

      {content ? (
        <div className="relative rounded-xl border border-gray-800 bg-gray-950 p-4">
          <div className="absolute right-3 top-3">
            <CopyButton text={content} />
          </div>
          <pre className="whitespace-pre-wrap text-sm text-gray-300">{content}</pre>
        </div>
      ) : suggestions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-700 p-6 text-center">
          <p className="text-sm text-gray-400">Not enough scan data yet.</p>
          <p className="mt-1 text-xs text-gray-600">
            Content angles appear after at least 3 platform scans with recurring findings.
          </p>
        </div>
      ) : null}
    </>
  );

  if (embedded) return <div id="social">{inner}</div>;

  return (
    <SectionCard id="social" title="Content ideas" subtitle="From real scan findings">
      {inner}
    </SectionCard>
  );
}
