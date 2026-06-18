'use client';

import { useState } from 'react';
import { SectionCard } from './MetricCard';
import CopyButton from './CopyButton';
import type { VideoAdScript } from '@/lib/owner/generators/video';

export default function VideoAdCreator() {
  const [duration, setDuration] = useState<15 | 30 | 60 | 90>(30);
  const [scripts, setScripts] = useState<VideoAdScript[]>([]);
  const [activeVersion, setActiveVersion] = useState(0);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch('/api/owner/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration,
          multiVersion: true,
          versionCount: 3,
          product: 'CyberShield',
          audience: 'small business owners',
          painPoint: 'Website security blind spots cost customers and revenue',
          cta: 'Start your free security scan at CyberShield',
        }),
      });
      const data = await res.json();
      if (data.scripts?.length) {
        setScripts(data.scripts);
        setActiveVersion(0);
      }
    } finally {
      setLoading(false);
    }
  }

  const script = scripts[activeVersion];

  const text = script
    ? `HOOK: ${script.hook}\n\n${script.scenes
        .map(
          (s) =>
            `[${s.timestamp}] VISUAL: ${s.visual}\nVO: ${s.voiceover}${s.overlay ? `\nOVERLAY: ${s.overlay}` : ''}`,
        )
        .join('\n\n')}\n\nCTA: ${script.cta}\nMood: ${script.musicMood}`
    : '';

  return (
    <SectionCard
      id="video"
      title="Video Ad Factory"
      subtitle="Multiple versions · hooks, scenes, voiceover, CTA for 15/30/60/90 sec"
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
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
          {loading ? 'Generating…' : 'Generate 3 Versions'}
        </button>
      </div>

      {scripts.length > 0 && (
        <div className="mb-4 flex gap-2">
          {scripts.map((s, i) => (
            <button
              key={s.version}
              type="button"
              onClick={() => setActiveVersion(i)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                activeVersion === i ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              V{s.version}: {s.hook.slice(0, 40)}…
            </button>
          ))}
        </div>
      )}

      {script && (
        <div className="relative rounded-xl border border-gray-800 bg-gray-950 p-4">
          <div className="absolute right-3 top-3">
            <CopyButton text={text} />
          </div>
          <p className="mb-2 text-xs font-medium text-violet-400">Hook: {script.hook}</p>
          <p className="mb-3 text-xs text-gray-500">Mood: {script.musicMood}</p>
          <pre className="whitespace-pre-wrap text-sm text-gray-300">{text}</pre>
        </div>
      )}
    </SectionCard>
  );
}
