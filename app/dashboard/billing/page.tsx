import { redirect } from 'next/navigation';

/** /app/billing rewrites here — billing lives under Settings. */
export default function BillingRedirectPage() {
  redirect('/app/settings');
}
