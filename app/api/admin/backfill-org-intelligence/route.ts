import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/owner';
import { backfillOrgIntelligenceForAllOrgs } from '@/lib/enterprise/backfillOrgIntelligence';
import { auditLog, extractIp } from '@/lib/audit/log';

/** POST /api/admin/backfill-org-intelligence — repair persisted org intelligence (owner only). */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isOwner(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const result = await backfillOrgIntelligenceForAllOrgs();

  auditLog({
    userId: user.id,
    action: 'org_intelligence_backfill',
    metadata: { processed: result.processed, errorCount: result.errors.length },
    ip: extractIp(req),
  });

  return NextResponse.json(result);
}
