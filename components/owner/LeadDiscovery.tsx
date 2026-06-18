'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SectionCard } from './MetricCard';
import ProspectPipeline from './ProspectPipeline';
import ProspectsActionQueue from './ProspectsActionQueue';
import RevenueOpportunityBar from './RevenueOpportunityBar';
import EmptyState from './EmptyState';
import type { OwnerProspect } from '@/lib/owner/types';
import type { DiscoverySettings, DiscoveryScope } from '@/lib/owner/discovery/settings';
import {
  DEFAULT_DISCOVERY_SETTINGS,
  DISCOVERY_SCOPE_OPTIONS,
} from '@/lib/owner/discovery/settings';
import { computeRevenueIntelligence, formatRevenue } from '@/lib/owner/revenueIntelligence';
import { hasActiveProspects } from '@/lib/owner/pipeline';
import { resolveProspectList } from '@/lib/owner/prospectDisplay';

interface ProviderDiagnostic {
  provider: string;
  status: 'succeeded' | 'failed' | 'skipped';
  found: number;
  failureReason?: string;
}

interface DiscoveryRun {
  id: string;
  discovered_count: number;
  inserted_count: number;
  scanned_count: number;
  skipped_count: number;
  qualified_count?: number;
  outreach_ready_count?: number;
  provider_diagnostics?: ProviderDiagnostic[] | null;
  created_at: string;
}

interface DiscoveryRunResponse {
  ok?: boolean;
  discovered?: number;
  inserted?: number;
  scanned?: number;
  skipped?: number;
  qualified?: number;
  outreachReady?: number;
  estimatedOpportunityMrr?: number;
  providerDiagnostics?: ProviderDiagnostic[];
}

function providerDisplayName(id: string): string {
  const map: Record<string, string> = {
    openstreetmap: 'OpenStreetMap',
    nominatim_search: 'Nominatim',
    directory_seed: 'Directory seed',
  };
  return map[id] ?? id.replace(/_/g, ' ');
}

export default function LeadDiscovery({
  initialProspects,
  embedded,
}: {
  initialProspects: OwnerProspect[];
  embedded?: boolean;
}) {
  const [prospects, setProspects] = useState(() => resolveProspectList(initialProspects));
  const [discovering, setDiscovering] = useState(false);
  const [runs, setRuns] = useState<DiscoveryRun[]>([]);
  const [lastRun, setLastRun] = useState<DiscoveryRunResponse | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAdvancedDiag, setShowAdvancedDiag] = useState<string | null>(null);
  const [importUrls, setImportUrls] = useState('');
  const [importing, setImporting] = useState(false);
  const [settings, setSettings] = useState<DiscoverySettings>(DEFAULT_DISCOVERY_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);

  const hasProspects = hasActiveProspects(prospects);
  const revenue = useMemo(() => computeRevenueIntelligence(prospects), [prospects]);

  const refreshProspects = useCallback(async () => {
    const res = await fetch('/api/owner/prospects');
    const data = await res.json();
    if (data.prospects) setProspects(resolveProspectList(data.prospects));
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
        setProspects((p) => resolveProspectList([...data.prospects, ...p]));
        setImportUrls('');
      }
    } finally {
      setImporting(false);
    }
  }

  function runOutcomes(run: DiscoveryRun | DiscoveryRunResponse) {
    if ('discovered_count' in run) {
      return {
        discovered: run.discovered_count,
        qualified: run.qualified_count ?? 0,
        outreachReady: run.outreach_ready_count ?? 0,
        skipped: run.skipped_count,
        scanned: run.scanned_count,
        mrr: 0,
      };
    }
    return {
      discovered: run.discovered ?? 0,
      qualified: run.qualified ?? 0,
      outreachReady: run.outreachReady ?? 0,
      skipped: run.skipped ?? 0,
      scanned: run.scanned ?? 0,
      mrr: run.estimatedOpportunityMrr ?? 0,
    };
  }

  function renderAdvancedDiagnostics(diagnostics: ProviderDiagnostic[] | null | undefined) {
    if (!diagnostics?.length) return null;
    return (
      <ul className="mt-2 space-y-1 rounded-lg border border-white/[0.04] bg-black/20 p-3 text-xs text-gray-500">
        {diagnostics.map((d) => (
          <li key={d.provider}>
            {providerDisplayName(d.provider)}: {d.status === 'succeeded' ? 'success' : d.status}
            {d.failureReason ? ` — ${d.failureReason}` : ''}
          </li>
        ))}
      </ul>
    );
  }

  const discoveryEmpty = (
    <EmptyState
      title="No qualified prospects yet"
      description="Run discovery to identify businesses that may benefit from CyberShield monitoring."
    />
  );

  const body = (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-white">Revenue intelligence platform</p>
          <p className="mt-1 text-sm text-gray-500">
            Find businesses most likely to become CyberShield customers
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 hover:border-violet-500/50"
          >
            {showSettings ? 'Hide search settings' : 'Search settings'}
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

      {hasProspects && <RevenueOpportunityBar summary={revenue} />}

      {showSettings && (
        <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="text-sm font-medium text-white">Search settings</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
              <span className="text-gray-400">Target industry</span>
              <select
                value={settings.industry}
                onChange={(e) => setSettings({ ...settings, industry: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
              >
                {['healthcare', 'dental', 'legal', 'accounting', 'technology', 'retail', 'general'].map(
                  (i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
          <div className="mt-4">
            <p className="text-xs text-gray-400">Search area</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DISCOVERY_SCOPE_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    settings.discoveryScope === opt.id
                      ? 'border-violet-500 bg-violet-500/10 text-white'
                      : 'border-gray-700 text-gray-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="scope"
                    className="sr-only"
                    checked={settings.discoveryScope === opt.id}
                    onChange={() =>
                      setSettings({ ...settings, discoveryScope: opt.id as DiscoveryScope })
                    }
                  />
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-xs text-gray-500">({opt.hint})</span>
                </label>
              ))}
            </div>
          </div>
          {settings.discoveryScope === 'custom' && (
            <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/20 p-4">
              <p className="text-xs font-medium text-gray-400">Advanced area controls</p>
              <label className="mt-2 block text-xs">
                <span className="text-gray-500">Custom radius (miles)</span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={settings.customRadiusMiles}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      customRadiusMiles: Number(e.target.value) || 25,
                    })
                  }
                  className="mt-1 w-full max-w-xs rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
                />
              </label>
            </div>
          )}
          <button
            type="button"
            onClick={saveSettings}
            disabled={savingSettings}
            className="mt-4 rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:border-violet-500/50 disabled:opacity-50"
          >
            {savingSettings ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      )}

      {lastRun?.ok && (
        <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <p className="text-sm font-semibold text-white">Discovery run complete</p>
          {(() => {
            const o = runOutcomes(lastRun);
            return (
              <div className="mt-2 space-y-1 text-sm text-gray-300">
                <p>{o.discovered} businesses found</p>
                <p>{o.qualified} qualified · {o.outreachReady} outreach-ready · {o.skipped} skipped</p>
                {o.mrr > 0 && (
                  <p className="text-emerald-300">
                    Estimated opportunity: {formatRevenue(o.mrr)}/month
                  </p>
                )}
              </div>
            );
          })()}
          {lastRun.providerDiagnostics && lastRun.providerDiagnostics.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAdvancedDiag(showAdvancedDiag === 'last' ? null : 'last')}
              className="mt-3 text-xs text-gray-500 hover:text-gray-300"
            >
              {showAdvancedDiag === 'last' ? 'Hide' : 'Show'} advanced diagnostics
            </button>
          )}
          {showAdvancedDiag === 'last' && renderAdvancedDiagnostics(lastRun.providerDiagnostics)}
        </div>
      )}

      {runs.length > 0 && (
        <div className="mb-8 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="text-sm font-medium text-white">Recent discovery outcomes</h3>
          <ul className="mt-3 space-y-3">
            {runs.slice(0, 6).map((run) => {
              const o = runOutcomes(run);
              return (
                <li key={run.id} className="rounded-lg border border-white/[0.04] px-4 py-3">
                  <p className="text-sm text-gray-300">
                    {o.discovered} discovered · {o.qualified} qualified · {o.outreachReady}{' '}
                    outreach-ready · {o.skipped} skipped
                  </p>
                  <p className="mt-0.5 text-xs text-gray-600">
                    {new Date(run.created_at).toLocaleString()}
                  </p>
                  {run.provider_diagnostics && run.provider_diagnostics.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setShowAdvancedDiag(showAdvancedDiag === run.id ? null : run.id)
                      }
                      className="mt-2 text-xs text-gray-500 hover:text-gray-300"
                    >
                      {showAdvancedDiag === run.id ? 'Hide' : 'Show'} advanced diagnostics
                    </button>
                  )}
                  {showAdvancedDiag === run.id && renderAdvancedDiagnostics(run.provider_diagnostics)}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!hasProspects ? discoveryEmpty : (
        <>
          <div className="mb-8">
            <ProspectsActionQueue prospects={prospects} onProspectsChange={setProspects} />
          </div>
          <ProspectPipeline prospects={prospects} onProspectsChange={setProspects} />
        </>
      )}

      <div className="mt-8 border-t border-white/10 pt-6">
        <button
          type="button"
          onClick={() => setShowImport((v) => !v)}
          className="text-xs text-gray-500 hover:text-gray-300"
        >
          {showImport ? 'Hide manual import' : 'Import websites manually'}
        </button>
        {showImport && (
          <div className="mt-3 space-y-3">
            <textarea
              placeholder="Paste real business website URLs (one per line)"
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
      title="Revenue intelligence"
      subtitle="Identify, qualify, and convert your best prospects"
    >
      {body}
    </SectionCard>
  );
}
