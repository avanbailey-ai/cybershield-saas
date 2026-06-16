import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeWebsiteHost } from './normalizeWebsiteUrl';

/** Returns an existing website in the org with the same normalized host, if any. */
export async function findDuplicateWebsiteInOrg(
  orgId: string,
  url: string,
): Promise<{ id: string; url: string; label: string | null } | null> {
  const host = normalizeWebsiteHost(url);
  const admin = createAdminClient();

  const { data: websites, error } = await admin
    .from('websites')
    .select('id, url, label')
    .eq('org_id', orgId)
    .eq('is_active', true);

  if (error) {
    throw new Error(error.message);
  }

  for (const site of websites ?? []) {
    try {
      if (normalizeWebsiteHost(site.url) === host) {
        return site;
      }
    } catch {
      continue;
    }
  }

  return null;
}
