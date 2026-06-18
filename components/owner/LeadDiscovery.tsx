'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SectionCard } from './MetricCard';
import ProspectPipeline from './ProspectPipeline';
import type { OwnerProspect } from '@/lib/owner/types';

interface DiscoveryRun {
  id: string;
  source: string;
  discovered_count: number;
  inserted_count: number;
  scanned_count: number;
  skipped_count: number;
  error_message: string | null;
  created_at: string;
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
  const [showImport, setShowImport] = useState(false);
  const [importUrls, setImportUrls] = useState('');
  const [importing, setImporting] = useState(false);

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

  useEffect(() => {
    refreshFeed();
  }, [refreshFeed]);

  async function runDiscovery() {
    setDiscovering(true);
    try {
      const res = await fetch('/api/owner/discovery/run', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
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
        <button
          type="button"
          onClick={runDiscovery}
          disabled={discovering}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {discovering ? 'Discovering…' : 'Run discovery now'}
        </button>
      </div>

      <div className="mb-8 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <h3 className="text-sm font-medium text-white">Discovery feed</h3>
        {runs.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No prospects discovered yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {runs.slice(0, 8).map((run) => (
              <li
                key={run.id}
                className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400"
              >
                <span>
                  {new Date(run.created_at).toLocaleString()} · {run.source}
                </span>
                <span>
                  {run.inserted_count} inserted · {run.scanned_count} scanned ·{' '}
                  {run.skipped_count} skipped
                  {run.error_message && (
                    <span className="ml-2 text-amber-500">{run.error_message}</span>
                  )}
                </span>
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
