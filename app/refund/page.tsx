import { redirect } from 'next/navigation';

/** Legacy URL — canonical refund policy lives at /refund-policy */
export default function RefundRedirectPage() {
  redirect('/refund-policy');
}
