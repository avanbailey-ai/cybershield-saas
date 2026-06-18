import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ensureUserOrg } from '@/lib/org/migrateExistingUsers';

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgId = await ensureUserOrg(user.id, user.email ?? null);
  return NextResponse.json({ ok: true, orgId });
}
