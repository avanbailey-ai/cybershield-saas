import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'CEO Dashboard — CyberShield',
  description: 'Redirected to Founder OS CEO Advisory',
};

export const dynamic = 'force-dynamic';

/** Legacy route — CEO Dashboard merged into Founder OS. */
export default function CeoDashboardPage() {
  redirect('/dashboard/admin/owner#ceo-advisory');
}
