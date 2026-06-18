import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { createAdminClient } from '@/lib/supabase/admin';
import { logOutreachEvent } from '@/lib/owner/outreachEvents';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const { userId } = await params;
  const body = await req.json();
  const { action } = body as { action: 'mark_healthy' | 'mark_at_risk' };

  if (action !== 'mark_healthy' && action !== 'mark_at_risk') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const admin = createAdminClient();
  const churnRiskScore = action === 'mark_healthy' ? 25 : 75;

  const { data, error } = await admin
    .from('profiles')
    .update({ churn_risk_score: churnRiskScore, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('id, email, churn_risk_score')
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Customer not found' }, { status: 404 });
  }

  await logOutreachEvent(admin, {
    event_type: 'customer_status_updated',
    recipient_email: data.email as string,
    detail: action === 'mark_healthy' ? 'Marked healthy by founder' : 'Marked at risk by founder',
    metadata: { user_id: userId, churn_risk_score: churnRiskScore },
  });

  return NextResponse.json({
    ok: true,
    customer: { userId: data.id, email: data.email, churnRiskScore: data.churn_risk_score },
  });
}
