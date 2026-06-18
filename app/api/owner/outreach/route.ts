import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import {
  generateOutreach,
  OUTREACH_TYPES,
  type OutreachType,
} from '@/lib/owner/generators/outreach';

export async function GET() {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }
  return NextResponse.json({ ok: true, types: OUTREACH_TYPES });
}

export async function POST(req: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const body = await req.json();
  const type = body.type as OutreachType;

  if (!type || !OUTREACH_TYPES.some((t) => t.id === type)) {
    return NextResponse.json({ error: 'Invalid outreach type' }, { status: 400 });
  }

  const content = generateOutreach(type, {
    businessName: body.businessName ?? 'Business',
    website: body.website ?? '',
    industry: body.industry,
    city: body.city,
    scanScore: body.scanScore,
    riskLevel: body.riskLevel,
    issues: body.issues,
    contactName: body.contactName,
  });

  return NextResponse.json({ ok: true, type, content });
}
