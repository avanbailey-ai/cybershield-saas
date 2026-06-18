import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchQaAccountFlags } from '@/lib/billing/qaAccessService';
import { parseQaSimulatedPlan, type QaSimulatedPlan } from '@/lib/auth/qaAccount';

const ALLOWED: QaSimulatedPlan[] = ['pro', 'growth', 'agency'];

/** PATCH body: { plan?, enterpriseEnabled? } — QA accounts only. */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const qaFlags = await fetchQaAccountFlags(user.id);
  if (!qaFlags.isQaAccount) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { plan?: string; enterpriseEnabled?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.plan !== undefined) {
    const plan = parseQaSimulatedPlan(body.plan);
    if (!ALLOWED.includes(plan)) {
      return NextResponse.json(
        { error: 'plan must be pro, growth, or agency' },
        { status: 400 },
      );
    }
    updates.qa_simulated_plan = plan;
  }

  if (typeof body.enterpriseEnabled === 'boolean') {
    updates.qa_enterprise_enabled = body.enterpriseEnabled;
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from('profiles').update(updates).eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const nextFlags = await fetchQaAccountFlags(user.id);
  return NextResponse.json({
    ok: true,
    qaSimulatedPlan: nextFlags.qaSimulatedPlan,
    qaEnterpriseEnabled: nextFlags.qaEnterpriseEnabled,
  });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const qaFlags = await fetchQaAccountFlags(user.id);
  if (!qaFlags.isQaAccount) {
    return NextResponse.json({ isQaAccount: false });
  }

  return NextResponse.json({
    isQaAccount: true,
    qaSimulatedPlan: qaFlags.qaSimulatedPlan,
    qaEnterpriseEnabled: qaFlags.qaEnterpriseEnabled,
  });
}
