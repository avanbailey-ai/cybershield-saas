import { redirect } from 'next/navigation';

export default function LegacyProblemReportsRedirect() {
  redirect('/dashboard/admin/beta-reports');
}
