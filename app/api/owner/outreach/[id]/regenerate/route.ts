import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateOutreach, type OutreachType } from '@/lib/owner/generators/outreach';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const { id } = await params;
  const admin = createAdminClient();

  const { data: draft } = await admin
    .from('owner_outreach_drafts')
    .select('*, owner_prospects(*)')
    .eq('id', id)
    .maybeSingle();

  if (!draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }

  const prospect = draft.owner_prospects as Record<string, unknown> | null;
  const findings = prospect?.scan_findings as { issues?: string[] } | null | undefined;
  const issues = findings?.issues;

  const outreachType = (draft.outreach_type as OutreachType) || 'cold_email';
  const content = generateOutreach(outreachType, {
    businessName: (draft.business_name as string) ?? (prospect?.business_name as string) ?? 'Business',
    website: (prospect?.website as string) ?? '',
    industry: (prospect?.industry as string) ?? undefined,
    city: (prospect?.city as string) ?? undefined,
    scanScore: prospect?.scan_score as number | undefined,
    riskLevel: (prospect?.scan_risk_level as string) ?? undefined,
    issues,
    contactEmail: (prospect?.contact_email as string) ?? (draft.recipient_email as string) ?? undefined,
  });

  const { data: updated, error } = await admin
    .from('owner_outreach_drafts')
    .update({ content, status: 'draft', send_error: null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, draft: updated });
}
