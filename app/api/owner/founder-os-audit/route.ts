import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { buildFounderOsAuditExport } from '@/lib/owner/founderOsAudit';

export async function GET() {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const audit = await buildFounderOsAuditExport();
  return NextResponse.json({ ok: true, audit });
}
