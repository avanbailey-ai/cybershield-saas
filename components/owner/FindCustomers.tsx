'use client';

import { useState } from 'react';
import type { RevenueEngineResult, RevenueSourceMode, RevenueTarget } from '@/lib/owner/revenueEngine';

type Step = 1 | 2 | 3 | 4;

const SOURCES: { id: RevenueSourceMode; label: string; hint: string }[] = [
  { id: 'free_sources', label: 'Free web sources', hint: 'Bounded OSM/Nominatim packs — no location required' },
  { id: 'paste_urls', label: 'Paste websites', hint: 'One domain per line' },
  { id: 'csv', label: 'Upload CSV', hint: 'website, name, industry columns' },
  { id: 'existing_pipeline', label: 'Existing pipeline', hint: 'Rescan stale / needs-contact prospects' },
  { id: 'source_url', label: 'Source / directory URL', hint: 'Public page with outbound website links' },
];

export default function FindCustomers({
  onComplete,
  initialOpen = true,
}: {
  onComplete?: () => void;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [step, setStep] = useState<Step>(1);
  const [source, setSource] = useState<RevenueSourceMode>('free_sources');
  const [target, setTarget] = useState<RevenueTarget>('both');
  const [urls, setUrls] = useState('');
  const [csv, setCsv] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RevenueEngineResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runEngine() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/owner/revenue-engine/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          target,
          urls: source === 'paste_urls' ? urls : undefined,
          csv: source === 'csv' ? csv : undefined,
          sourceUrl: source === 'source_url' ? sourceUrl : undefined,
          locationFilter: locationFilter.trim() || undefined,
        }),
      });
      const data = (await res.json()) as RevenueEngineResult & { ok?: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? 'Run failed');
        return;
      }
      setResult(data);
      setStep(4);
      onComplete?.();
    } catch {
      setError('Network error');
    } finally {
      setRunning(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
      >
        Find customers
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Find customers</h2>
          <p className="mt-1 text-sm text-gray-400">
            Website-first revenue engine — scan → score → contact path → draft queue. Location optional.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-gray-500 hover:text-white"
        >
          Collapse
        </button>
      </div>

      {step === 1 && (
        <div className="mt-5 space-y-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Step 1 — How do you want to find websites?
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {SOURCES.map((s) => (
              <label
                key={s.id}
                className={`cursor-pointer rounded-xl border p-3 ${
                  source === s.id
                    ? 'border-emerald-500/50 bg-emerald-500/10'
                    : 'border-white/[0.06] bg-black/20'
                }`}
              >
                <input
                  type="radio"
                  className="sr-only"
                  checked={source === s.id}
                  onChange={() => setSource(s.id)}
                />
                <p className="text-sm font-medium text-white">{s.label}</p>
                <p className="mt-1 text-xs text-gray-500">{s.hint}</p>
              </label>
            ))}
          </div>
          <label className="block text-xs text-gray-400">
            Optional location filter (not required)
            <input
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              placeholder="e.g. Oregon — leave blank for US-wide packs"
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
            />
          </label>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-500"
          >
            Next
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="mt-5 space-y-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Step 2 — Target
          </p>
          {(['both', 'smb', 'agency'] as RevenueTarget[]).map((t) => (
            <label key={t} className="mr-4 inline-flex items-center gap-2 text-sm text-gray-300">
              <input
                type="radio"
                checked={target === t}
                onChange={() => setTarget(t)}
                className="accent-emerald-500"
              />
              {t === 'both' ? 'SMBs + Agencies' : t === 'smb' ? 'SMBs' : 'Agencies'}
            </label>
          ))}
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(1)} className="text-sm text-gray-400">
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="mt-5 space-y-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Step 3 — Input & run
          </p>
          <p className="text-xs text-gray-500">
            Pipeline if score ≤ 70, or ≤ 80 with high-severity issue. Max 25 scans per run.
          </p>
          {source === 'paste_urls' && (
            <textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              rows={6}
              placeholder="example.com&#10;another-business.com"
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
            />
          )}
          {source === 'csv' && (
            <textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              rows={6}
              placeholder="website,name,industry"
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
            />
          )}
          {source === 'source_url' && (
            <input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://example.com/directory-page"
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
            />
          )}
          {(source === 'free_sources' || source === 'existing_pipeline') && (
            <p className="text-sm text-gray-400">
              No input required — uses bounded free source packs or your existing pipeline.
            </p>
          )}
          {error && <p className="text-sm text-red-300">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(2)} className="text-sm text-gray-400">
              Back
            </button>
            <button
              type="button"
              disabled={running}
              onClick={runEngine}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {running ? 'Scanning…' : 'Run revenue engine'}
            </button>
          </div>
        </div>
      )}

      {step === 4 && result && (
        <div className="mt-5 space-y-4">
          <p className="text-sm text-emerald-200">{result.summaryMessage}</p>
          <p className="text-xs text-violet-300">Next: {result.nextRecommendedAction}</p>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <Stat label="Found" value={result.websitesFound} />
            <Stat label="Scanned" value={result.websitesScanned} />
            <Stat label="Weak score" value={result.weakScoreLeads} />
            <Stat label="Contact paths" value={result.contactPathsFound} />
            <Stat label="Drafts" value={result.draftsGenerated} />
            <Stat label="Needs contact" value={result.needsContact} />
            <Stat label="Existing" value={result.alreadyInPipeline} />
            <Stat label="Not urgent" value={result.notUrgent} />
          </div>
          {result.results.length > 0 && (
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {result.results.slice(0, 15).map((r) => (
                <li
                  key={`${r.domain}-${r.status}`}
                  className="rounded-lg border border-white/[0.06] bg-black/20 p-3 text-xs"
                >
                  <p className="font-medium text-white">
                    {r.businessName}{' '}
                    <span className="text-gray-500">· {r.domain}</span>
                  </p>
                  <p className="mt-1 text-gray-400">
                    Score {r.scanScore ?? '—'} · {r.status.replace(/_/g, ' ')} · {r.contactPath.replace(/_/g, ' ')}
                  </p>
                  {r.topFindings.length > 0 && (
                    <p className="mt-1 text-amber-200/80">{r.topFindings.join(' · ')}</p>
                  )}
                  <p className="mt-1 text-violet-300">{r.nextAction}</p>
                  {r.contactFormUrl && (
                    <a
                      href={r.contactFormUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-emerald-400 hover:underline"
                    >
                      Open contact form
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => {
              setStep(1);
              setResult(null);
            }}
            className="text-sm text-gray-400 hover:text-white"
          >
            Run again
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/[0.04] bg-black/20 px-2 py-2">
      <p className="text-[10px] uppercase text-gray-500">{label}</p>
      <p className="text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
