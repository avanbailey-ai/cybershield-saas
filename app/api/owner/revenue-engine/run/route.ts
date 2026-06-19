import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { runRevenueEngine, type RunRevenueEngineOptions } from '@/lib/owner/runRevenueEngine';
import type { RevenueSourceMode, RevenueTarget } from '@/lib/owner/revenueEngine';

function parseSource(value: unknown): RevenueSourceMode {
  const allowed: RevenueSourceMode[] = [
    'free_sources',
    'paste_urls',
    'csv',
    'existing_pipeline',
    'source_url',
  ];
  return allowed.includes(value as RevenueSourceMode) ? (value as RevenueSourceMode) : 'paste_urls';
}

function parseTarget(value: unknown): RevenueTarget {
  if (value === 'smb' || value === 'agency' || value === 'both') return value;
  return 'both';
}

export async function POST(req: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }

  const options: RunRevenueEngineOptions = {
    source: parseSource(body.source),
    target: parseTarget(body.target),
    urls: typeof body.urls === 'string' ? body.urls : undefined,
    csv: typeof body.csv === 'string' ? body.csv : undefined,
    sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl : undefined,
    locationFilter: typeof body.locationFilter === 'string' ? body.locationFilter : undefined,
  };

  try {
    const result = await runRevenueEngine(options);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[owner/revenue-engine/run]', err);
    return NextResponse.json({ error: 'Revenue engine run failed' }, { status: 500 });
  }
}
