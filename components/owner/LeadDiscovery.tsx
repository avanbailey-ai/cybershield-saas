'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SectionCard } from './MetricCard';
import ProspectPipeline from './ProspectPipeline';
import type { OwnerProspect } from '@/lib/owner/types';
import type { DiscoverySettings } from '@/lib/owner/discovery/settings';
import { DEFAULT_DISCOVERY_SETTINGS } from '@/lib/owner/discovery/settings';

interface ProviderDiagnostic {
  provider: string;
  status: 'succeeded' | 'failed' | 'skipped';
  found: number;
  statusCode?: number;
  responseSnippet?: string;
  queryHash?: string;
  failureReason?: string;
}

interface DiscoveryRun {
  id: string;
  source: string;
  discovered_count: number;
  inserted_count: number;
  scanned_count: number;
  skipped_count: number;
  error_message: string | null;
  provider_diagnostics?: ProviderDiagnostic[] | null;
  created_at: string;
}

interface DiscoveryRunResponse {
  ok?: boolean;
  discovered?: number;
  inserted?: number;
  scanned?: number;
  skipped?: number;
  validated?: number;
  errors?: string[];
  providerDiagnostics?: ProviderDiagnostic[];
}

export default function LeadDiscovery({
  initialProspects,
  embedded,
}: {
  initialProspects: OwnerProspect[];
  embedded?: boolean;
}) {
  const [prospects, setProspects] = useState(initialProspects);
  const [discovering, setDiscovering] = useState(false);
  const [runs, setRuns] = useState<DiscoveryRun[]>([]);
  const [lastRun, setLastRun] = useState<DiscoveryRunResponse | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const [importUrls, setImportUrls] = useState('');
  const [importing, setImporting] = useState(false);
  const [settings, setSettings] = useState<DiscoverySettings>(DEFAULT_DISCOVERY_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);

  const stats = useMemo(() => {
    const hot = prospects.filter((p) => p.lead_score === 'HOT').length;
    const pending = prospects.filter((p) => p.scan_status === 'pending').length;
    const scanned = prospects.filter((p) => p.scan_status === 'completed').length;
    const auto = prospects.filter(
      (p) => p.discovery_source && p.discovery_source !== 'manual',
    ).length;
    return { hot, pending, scanned, total: prospects.length, auto };
  }, [prospects]);

  const refreshProspects = useCallback(async () => {
    const res = await fetch('/api/owner/prospects');
    const data = await res.json();
    if (data.prospects) setProspects(data.prospects);
  }, []);

  const refreshFeed = useCallback(async () => {
    const res = await fetch('/api/owner/discovery');
    const data = await res.json();
    if (data.runs) setRuns(data.runs);
  }, []);

  const loadSettings = useCallback(async () => {
    const res = await fetch('/api/owner/settings');
    const data = await res.json();
    if (data.discovery) setSettings(data.discovery);
  }, []);

  useEffect(() => {
    refreshFeed();
    loadSettings();
  }, [refreshFeed, loadSettings]);

  async function saveSettings() {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/owner/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discovery: settings }),
      });
      const data = await res.json();
      if (data.discovery) setSettings(data.discovery);
    } finally {
      setSavingSettings(false);
    }
  }

  async function runDiscovery() {
    setDiscovering(true);
    setLastRun(null);
    try {
      const res = await fetch('/api/owner/discovery/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discovery: settings }),
      });
      const data = (await res.json()) as DiscoveryRunResponse;
      if (data.ok) {
        setLastRun(data);
        await refreshProspects();
        await refreshFeed();
      }
    } finally {
      setDiscovering(false);
    }
  }

  async function runUrlImport() {
    if (!importUrls.trim()) return;
    setImporting(true);
    try {
      const res = await fetch('/api/owner/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'batch', urls: importUrls, autoScan: true }),
      });
      const data = await res.json();
      if (data.prospects?.length) {
        setProspects((p) => [...data.prospects, ...p]);
        setImportUrls('');
      }
    } finally {
      setImporting(false);
    }
  }

  function renderDiagnostics(
    diagnostics: ProviderDiagnostic[] | null | undefined,
    compact?: boolean,
  ) {
    if (!diagnostics?.length) return null;
    return (
      <ul className={`space-y-1 ${compact ? 'text-xs' : 'text-sm'}`}>
        {diagnostics.map((d) => (
          <li key={d.provider} className="text-gray-400">
            <span
              className={
                d.status === 'succeeded'
                  ? 'text-emerald-400'
                  : d.status === 'skipped'
                    ? 'text-gray-500'
                    : 'text-amber-400'
              }
            >
              {d.provider}: {d.status}
            </span>
            {d.found > 0 && <span className="ml-2">({d.found} found)</span>}
            {d.failureReason && (
              <span className="ml-2 text-amber-500">{d.failureReason}</span>
            )}
          </li>
        ))}
      </ul>
    );
  }

  const zeroResultHelp = (
    <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-gray-400">
      <p className="font-medium text-amber-200/90">Discovery did not find new prospects.</p>
      <p className="mt-1">Try:</p>
      <ul className="mt-1 list-inside list-disc space-y-0.5">
        <li>Changing location or industry</li>
        <li>Adding a public directory URL as a seed source</li>
        <li>Importing a CSV of real websites</li>
        <li>Adding websites manually</li>
      </ul>
    </div>
  );

  const body = (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-gray-400">
            {stats.total > 0
              ? `${stats.total} prospects · ${stats.auto} auto-discovered · ${stats.scanned} scanned · ${stats.hot} HOT`
              : 'Automated discovery finds real businesses from public sources'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 hover:border-violet-500/50"
          >
            {showSettings ? 'Hide settings' : 'Discovery settings'}
          </button>
          <button
            type="button"
            onClick={runDiscovery}
            disabled={discovering}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {discovering ? 'Discovering…' : 'Run discovery'}
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="text-sm font-medium text-white">Discovery settings</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block text-xs">
              <span className="text-gray-400">Location</span>
              <input
                value={settings.location}
                onChange={(e) => setSettings({ ...settings, location: e.target.value })}
                placeholder="Medford, OR"
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs">
              <span className="text-gray-400">Industry</span>
              <select
                value={settings.industry}
                onChange={(e) => setSettings({ ...settings, industry: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
              >
                {[
                  'healthcare',
                  'dental',
                  'legal',
                  'contractors',
                  'retail',
                  'hospitality',
                  'technology',
                  'general',
                ].map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              <span className="text-gray-400">Radius (meters)</span>
              <input
                type="number"
                min={1000}
                max={25000}
                value={settings.radiusMeters}
                onChange={(e) =>
                  setSettings({ ...settings, radiusMeters: Number(e.target.value) || 15000 })
                }
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs">
              <span className="text-gray-400">Max prospects per run</span>
              <input
                type="number"
                min={1}
                max={50}
                value={settings.maxProspectsPerRun}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maxProspectsPerRun: Number(e.target.value) || 25,
                  })
                }
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs sm:col-span-2">
              <span className="text-gray-400">Seed directory URL (optional)</span>
              <input
                value={settings.seedDirectoryUrl ?? ''}
                onChange={(e) =>
                  setSettings({ ...settings, seedDirectoryUrl: e.target.value || null })
                }
                placeholder="https://example-chamber.org/member-directory"
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-400">
            {(
              [
                ['openstreetmap', 'OpenStreetMap (Overpass)'],
                ['nominatim_search', 'Nominatim search fallback'],
                ['directory_seed', 'Directory seed URL'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.providers[key]}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      providers: { ...settings.providers, [key]: e.target.checked },
                    })
                  }
                />
                {label}
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={saveSettings}
            disabled={savingSettings}
            className="mt-3 rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:border-violet-500/50 disabled:opacity-50"
          >
            {savingSettings ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      )}

      {lastRun?.ok && (
        <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="text-sm font-medium text-white">Last run</h3>
          <p className="mt-1 text-xs text-gray-400">
            Discovered: {lastRun.discovered ?? 0} · Validated: {lastRun.validated ?? 0} ·
            Inserted: {lastRun.inserted ?? 0} · Scans queued: {lastRun.scanned ?? 0} · Skipped:{' '}
            {lastRun.skipped ?? 0}
          </p>
          <div className="mt-2">{renderDiagnostics(lastRun.providerDiagnostics)}</div>
          {(lastRun.inserted ?? 0) === 0 && zeroResultHelp}
        </div>
      )}

      <div className="mb-8 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <h3 className="text-sm font-medium text-white">Discovery feed</h3>
        {runs.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No prospects discovered yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {runs.slice(0, 8).map((run) => (
              <li key={run.id} className="text-xs text-gray-400">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {new Date(run.created_at).toLocaleString()} · {run.source}
                  </span>
                  <span>
                    {run.inserted_count} inserted · {run.scanned_count} scanned ·{' '}
                    {run.skipped_count} skipped
                  </span>
                </div>
                {renderDiagnostics(run.provider_diagnostics, true)}
                {run.error_message && run.inserted_count === 0 && (
                  <p className="mt-1 text-amber-500">{run.error_message}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ProspectPipeline prospects={prospects} onProspectsChange={setProspects} />

      <div className="mt-8 border-t border-white/10 pt-6">
        <button
          type="button"
          onClick={() => setShowImport((v) => !v)}
          className="text-xs text-gray-500 hover:text-gray-300"
        >
          {showImport ? 'Hide manual import' : 'Manual URL import (secondary)'}
        </button>
        {showImport && (
          <div className="mt-3 space-y-3">
            <textarea
              placeholder="Paste real website URLs (one per line)"
              value={importUrls}
              onChange={(e) => setImportUrls(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
            />
            <button
              type="button"
              onClick={runUrlImport}
              disabled={importing || !importUrls.trim()}
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:border-violet-500/50 disabled:opacity-50"
            >
              {importing ? 'Importing…' : 'Import URLs'}
            </button>
          </div>
        )}
      </div>
    </>
  );

  if (embedded) {
    return <div id="prospects">{body}</div>;
  }

  return (
    <SectionCard
      id="prospects"
      title="Prospects"
      subtitle="Discover → scan → score → outreach pipeline"
    >
      {body}
    </SectionCard>
  );
}
