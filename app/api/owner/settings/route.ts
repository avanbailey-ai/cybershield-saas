import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  DEFAULT_AUTO_ARCHIVE,
  getAutoArchiveSettings,
  type AutoArchiveSettings,
} from '@/lib/owner/autoArchive';

export async function GET() {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const admin = createAdminClient();
  const settings = await getAutoArchiveSettings(admin);
  return NextResponse.json({ ok: true, settings });
}

export async function PUT(req: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const body = (await req.json()) as Partial<AutoArchiveSettings>;
  const settings: AutoArchiveSettings = { ...DEFAULT_AUTO_ARCHIVE, ...body };
  const admin = createAdminClient();

  const { error } = await admin.from('owner_founder_settings').upsert({
    key: 'auto_archive',
    value: settings,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, settings });
}
