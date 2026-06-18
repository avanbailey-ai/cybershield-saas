'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SectionCard } from './MetricCard';
import ProspectPipeline from './ProspectPipeline';
import type { OwnerProspect } from '@/lib/owner/types';
import type { DiscoverySettings, DiscoveryScope } from '@/lib/owner/discovery/settings';
import {
  DEFAULT_DISCOVERY_SETTINGS,
  DISCOVERY_SCOPE_OPTIONS,
} from '@/lib/owner/discovery/settings';

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
  qualified_count?: number;
  outreach_ready_count?: number;
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
  qualified?: number;
  outreachReady?: number;
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
  const [expandedDiag, setExpandedDiag] = useState<string | null>(null);
  const [importUrls, setImportUrls] = useState('');
  const [importing, setImporting] = useState(false);
  const [settings, setSettings] = useState<DiscoverySettings>(DEFAULT_DISCOVERY_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);

  const stats = useMemo(() => {
    const active = prospects.filter(
      (p) => p.pipeline_state !== 'archived' && p.pipeline_state !== 'ignore_forever',
    );
    const qualified = active.filter((p) =>
      ['qualified', 'outreach_ready', 'contacted', 'interested'].includes(p.pipeline_state),
    ).length;
    const outreachReady = active.filter((p) => p.pipeline_state === 'outreach_ready').length;
    const scanned = active.filter((p) => p.scan_status === 'completed').length;
    return {
      total: active.length,
      qualified,
      outreachReady,
      scanned,
    };
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

  function outcomeSummary(run: DiscoveryRun | DiscoveryRunResponse) {
    if ('discovered_count' in run) {
      return `${run.discovered_count} businesses discovered · ${run.inserted_count} added · ${run.scanned_count} scanned · ${run.qualified_count ?? 0} qualified · ${run.outreach_ready_count ?? 0} outreach-ready`;
    }
    return `${run.discovered ?? 0} businesses discovered · ${run.inserted ?? 0} added · ${run.scanned ?? 0} scanned · ${run.qualified ?? 0} qualified · ${run.outreachReady ?? 0} outreach-ready`;
  }

  function renderDiagnostics(diagnostics: ProviderDiagnostic[] | null | undefined) {
    if (!diagnostics?.length) return null;
    return (
      <ul className="mt-2 space-y-1 text-xs">
        {diagnostics.map((d) => (
          <li key={d.provider} className="text-gray-500">
            {d.provider}: {d.status}
            {d.found > 0 && ` (${d.found} raw)`}
            {d.failureReason && ` — ${d.failureReason}`}
          </li>
        ))}
      </ul>
    );
  }

  const zeroResultHelp = (
    <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-gray-400">
      <p className="font-medium text-amber-200/90">No new qualified prospects this run.</p>
      <p className="mt-1">Try a wider scope, different industry, or add a directory seed URL.</p>
    </div>
  );

  const body = (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-gray-400">
          {stats.total > 0
            ? `${stats.total} active · ${stats.qualified} qualified · ${stats.scanned} scanned · ${stats.outreachReady} outreach-ready`
            : 'Sales intelligence pipeline — discover, qualify, and prioritize real businesses'}
        </p>
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
                  'accounting',
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
            <div className="block text-xs sm:col-span-2 lg:col-span-3">
              <span className="text-gray-400">Discovery scope</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {DISCOVERY_SCOPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      setSettings({ ...settings, discoveryScope: opt.id as DiscoveryScope })
                    }
                    className={`rounded-lg border px-3 py-2 text-left text-sm ${
                      settings.discoveryScope === opt.id
                        ? 'border-violet-500 bg-violet-500/10 text-white'
                        : 'border-gray-700 text-gray-400 hover:border-violet-500/40'
                    }`}
                  >
                    <span className="font-medium">{opt.label}</span>
                    <span className="ml-2 text-xs text-gray-500">{opt.hint}</span>
                  </button>
                ))}
              </div>
            </div>
            {settings.discoveryScope === 'custom' && (
              <label className="block text-xs">
                <span className="text-gray-400">Custom radius (meters)</span>
                <input
                  type="number"
                  min={1000}
                  max={500000}
                  value={settings.customRadiusMeters}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      customRadiusMeters: Number(e.target.value) || 15000,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
                />
              </label>
            )}
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
                placeholder="https://your-chamber.org/member-directory"
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
              />
            </label>
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
          <h3 className="text-sm font-medium text-white">Last run outcomes</h3>
          <p className="mt-1 text-sm text-gray-300">{outcomeSummary(lastRun)}</p>
          {lastRun.providerDiagnostics && lastRun.providerDiagnostics.length > 0 && (
            <button
              type="button"
              onClick={() => setExpandedDiag(expandedDiag === 'last' ? null : 'last')}
              className="mt-2 text-xs text-gray-500 hover:text-gray-300"
            >
              {expandedDiag === 'last' ? 'Hide' : 'Show'} provider diagnostics
            </button>
          )}
          {expandedDiag === 'last' && renderDiagnostics(lastRun.providerDiagnostics)}
          {(lastRun.inserted ?? 0) === 0 && zeroResultHelp}
        </div>
      )}

      <div className="mb-8 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <h3 className="text-sm font-medium text-white">Discovery feed</h3>
        {runs.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No discovery runs yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {runs.slice(0, 8).map((run) => (
              <li key={run.id} className="rounded-lg border border-white/[0.04] px-3 py-2">
                <p className="text-sm text-gray-300">{outcomeSummary(run)}</p>
                <p className="mt-0.5 text-xs text-gray-600">
                  {new Date(run.created_at).toLocaleString()}
                </p>
                {run.provider_diagnostics && run.provider_diagnostics.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedDiag(expandedDiag === run.id ? null : run.id)
                    }
                    className="mt-1 text-xs text-gray-500 hover:text-gray-300"
                  >
                    {expandedDiag === run.id ? 'Hide' : 'Show'} provider diagnostics
                  </button>
                )}
                {expandedDiag === run.id && renderDiagnostics(run.provider_diagnostics)}
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
      title="Sales intelligence pipeline"
      subtitle="Discover → qualify → score → outreach"
    >
      {body}
    </SectionCard>
  );
}
