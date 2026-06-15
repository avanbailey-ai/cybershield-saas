import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/owner';
import { migrateExistingUsers } from '@/lib/org/migrateExistingUsers';
import { auditLog, extractIp } from '@/lib/audit/log';

/**
 * POST /api/admin/migrate-orgs
 * One-time backfill: create default orgs for profiles without default_org_id.
 * Platform owner only.
 */
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

  const result = await migrateExistingUsers();

  auditLog({
    userId: user.id,
    action: 'org_migration_run',
    metadata: { migrated: result.migrated, skipped: result.skipped, errorCount: result.errors.length },
    ip: extractIp(req),
  });

  return NextResponse.json(result);
}
