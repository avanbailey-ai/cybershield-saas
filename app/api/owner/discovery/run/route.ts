import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { runProspectDiscovery, scanPendingProspects } from '@/lib/owner/discovery/engine';
import type { DiscoverySettings } from '@/lib/owner/discovery/settings';
import { AGENCY_TYPE_OPTIONS, type AgencyType } from '@/lib/owner/agency/agencyTypes';

const VALID_AGENCY_TYPES = new Set<string>(AGENCY_TYPE_OPTIONS.map((o) => o.id));

/** Coerce arbitrary client input to a known AgencyType, defaulting to 'unknown'. */
function toAgencyType(value: unknown): AgencyType {
  return typeof value === 'string' && VALID_AGENCY_TYPES.has(value)
    ? (value as AgencyType)
    : 'unknown';
}

export async function POST(req: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  let discoveryOverrides: Partial<DiscoverySettings> | undefined;
  let agencyMode = false;
  let agencyType: AgencyType | undefined;
  try {
    const body = await req.json();
    if (body && typeof body === 'object') {
      discoveryOverrides = body.discovery ?? body;
      agencyMode = body.agencyMode === true;
      if (body.agencyType !== undefined) agencyType = toAgencyType(body.agencyType);
    }
  } catch {
    /* empty body is fine */
  }

  try {
    const result = await runProspectDiscovery({
      settings: discoveryOverrides,
      autoScan: true,
      agencyMode,
      agencyType,
    });
    const extraScanned = await scanPendingProspects(5);
    return NextResponse.json({
      ok: true,
      ...result,
      scanned: result.scanned + extraScanned,
    });
  } catch (err) {
    console.error('[owner/discovery/run]', err);
    return NextResponse.json({ error: 'Discovery failed' }, { status: 500 });
  }
}
