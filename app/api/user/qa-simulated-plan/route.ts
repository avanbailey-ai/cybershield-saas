import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchQaAccountFlags } from '@/lib/billing/qaAccessService';
import { parseQaSimulatedPlan, type QaSimulatedPlan } from '@/lib/auth/qaAccount';

const ALLOWED: QaSimulatedPlan[] = ['pro', 'growth', 'agency'];

/** PATCH body: { plan: 'pro' | 'growth' | 'agency' } — QA accounts only. */
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

  let body: { plan?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const plan = parseQaSimulatedPlan(body.plan);
  if (!body.plan || !ALLOWED.includes(plan)) {
    return NextResponse.json(
      { error: 'plan must be pro, growth, or agency' },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('profiles')
    .update({ qa_simulated_plan: plan, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, qaSimulatedPlan: plan });
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
  });
}
