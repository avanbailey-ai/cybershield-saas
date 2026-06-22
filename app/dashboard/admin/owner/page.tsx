import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isOwner } from '@/lib/auth/owner';
import { getFounderCommandCenter, EMPTY_FOUNDER_COMMAND_CENTER } from '@/lib/owner/founderCommandCenter';
import { EMPTY_FOUNDER_OS_V6 } from '@/lib/owner/founderOsV6';
import FounderOs from '@/components/owner/FounderOs';
import type { OwnerCrmLead } from '@/lib/owner/types';

export const metadata: Metadata = {
  title: 'Founder OS — CyberShield',
  description: 'Founder command center for CyberShieldCloud operations',
};

export const dynamic = 'force-dynamic';

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export default async function OwnerCommandCenterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isOwner(user.email)) {
    redirect('/login');
  }

  const admin = createAdminClient();

  const [commandCenter, crmRes] = await Promise.all([
    safeQuery(() => getFounderCommandCenter(), {
      ...EMPTY_FOUNDER_COMMAND_CENTER,
      generatedAt: new Date().toISOString(),
    }),
    safeQuery(async () => {
      const { data } = await admin
        .from('owner_crm_leads')
        .select('*')
        .order('updated_at', { ascending: false });
      return { data: data ?? [] };
    }, { data: [] as OwnerCrmLead[] }),
  ]);

  return (
    <FounderOs
      email={user.email ?? 'Owner'}
      commandCenter={commandCenter}
      crmLeads={crmRes.data ?? []}
      legacyFounder={EMPTY_FOUNDER_OS_V6}
    />
  );
}
