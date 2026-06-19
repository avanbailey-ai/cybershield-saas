import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/owner';

export const metadata: Metadata = {
  title: 'CEO Dashboard — CyberShield',
  description: 'Redirected to Founder OS CEO Advisory',
};

export const dynamic = 'force-dynamic';

/** Legacy route — CEO Dashboard merged into Founder OS. */
export default async function CeoDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isOwner(user.email)) {
    redirect('/login');
  }

  redirect('/dashboard/admin/owner#insights');
}
