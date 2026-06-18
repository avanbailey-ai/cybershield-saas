'use client';

import { useState } from 'react';
import { SectionCard } from './MetricCard';
import CopyButton from './CopyButton';
import type { VideoAdScript } from '@/lib/owner/generators/video';

export default function VideoAdCreator() {
  const [duration, setDuration] = useState<15 | 30 | 60 | 90>(30);
  const [script, setScript] = useState<VideoAdScript | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch('/api/owner/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration,
          product: 'CyberShield',
          audience: 'small business owners',
          painPoint: 'Website security blind spots cost customers and revenue',
          cta: 'Start your free security scan at CyberShield',
        }),
      });
      const data = await res.json();
      if (data.script) setScript(data.script);
    } finally {
      setLoading(false);
    }
  }

  const text = script
    ? script.scenes
        .map(
          (s) =>
            `[${s.timestamp}] VISUAL: ${s.visual}\nVO: ${s.voiceover}${s.overlay ? `\nOVERLAY: ${s.overlay}` : ''}`,
        )
        .join('\n\n')
    : '';

  return (
    <SectionCard
      id="video"
      title="AI Video Ad Creator"
      subtitle="Scene descriptions, voiceover, overlays, and CTA"
    >
      <div className="mb-4 flex flex-wrap gap-3">
        {([15, 30, 60, 90] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDuration(d)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              duration === d
                ? 'bg-violet-600 text-white'
                : 'border border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            {d}s
          </button>
        ))}
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {loading ? 'Generating…' : 'Generate Script'}
        </button>
      </div>

      {script && (
        <div className="relative rounded-xl border border-gray-800 bg-gray-950 p-4">
          <div className="absolute right-3 top-3">
            <CopyButton text={text} />
          </div>
          <p className="mb-3 text-xs text-gray-500">Mood: {script.musicMood}</p>
          <pre className="whitespace-pre-wrap text-sm text-gray-300">{text}</pre>
        </div>
      )}
    </SectionCard>
  );
}
