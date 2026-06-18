import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  DEFAULT_AUTO_ARCHIVE,
  getAutoArchiveSettings,
  type AutoArchiveSettings,
} from '@/lib/owner/autoArchive';
import {
  DEFAULT_DISCOVERY_SETTINGS,
  getDiscoverySettings,
  type DiscoverySettings,
} from '@/lib/owner/discovery/settings';
import {
  getOutreachSettings,
  saveOutreachSettings,
  type OutreachExecutionSettings,
} from '@/lib/owner/outreachSettings';

export async function GET() {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const admin = createAdminClient();
  const [autoArchive, discovery, outreach] = await Promise.all([
    getAutoArchiveSettings(admin),
    getDiscoverySettings(admin),
    getOutreachSettings(admin),
  ]);

  return NextResponse.json({
    ok: true,
    settings: autoArchive,
    discovery,
    outreach,
  });
}

export async function PUT(req: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const body = (await req.json()) as {
    settings?: Partial<AutoArchiveSettings>;
    discovery?: Partial<DiscoverySettings>;
    outreach?: Partial<OutreachExecutionSettings>;
  };

  const admin = createAdminClient();
  const results: Record<string, unknown> = { ok: true };

  if (body.settings) {
    const settings: AutoArchiveSettings = { ...DEFAULT_AUTO_ARCHIVE, ...body.settings };
    const { error } = await admin.from('owner_founder_settings').upsert({
      key: 'auto_archive',
      value: settings,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    results.settings = settings;
  }

  if (body.discovery) {
    const current = await getDiscoverySettings(admin);
    const discovery: DiscoverySettings = {
      ...current,
      ...body.discovery,
      providers: {
        ...current.providers,
        ...(body.discovery.providers ?? {}),
      },
    };
    const { error } = await admin.from('owner_founder_settings').upsert({
      key: 'discovery',
      value: discovery,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    results.discovery = discovery;
  }

  if (body.outreach) {
    const outreach = await saveOutreachSettings(admin, body.outreach);
    results.outreach = outreach;
  }

  return NextResponse.json(results);
}
