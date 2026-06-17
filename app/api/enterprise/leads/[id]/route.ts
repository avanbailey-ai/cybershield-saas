import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isOwner } from '@/lib/auth/owner';
import type { EnterpriseLeadStatus } from '@/lib/sales/leadValidation';
import { isExcludedLeadStatus } from '@/lib/sales/leadValidation';

const CONTACT_STATUSES: EnterpriseLeadStatus[] = ['contacted', 'responded'];

interface PatchBody {
  status?: EnterpriseLeadStatus;
  admin_notes?: string;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isOwner(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const admin = createAdminClient();
  const updates: Record<string, unknown> = {};

  if (body.status) {
    updates.status = body.status;
    if (CONTACT_STATUSES.includes(body.status)) {
      updates.last_contacted_at = new Date().toISOString();
    }
  }

  if (typeof body.admin_notes === 'string') {
    updates.admin_notes = body.admin_notes.trim() || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
  }

  const { data: lead, error } = await admin
    .from('enterprise_leads')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !lead) {
    console.error('[enterprise/leads/id] update failed:', error);
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  if (body.status && isExcludedLeadStatus(body.status)) {
    await admin
      .from('enterprise_pipeline')
      .update({ value_estimate: 0 })
      .eq('lead_id', id);
  }

  return NextResponse.json({ ok: true, lead });
}
