import { redirect } from 'next/navigation';

/** Enterprise marketing hub — default to demo request flow. */
export default function EnterpriseIndexPage() {
  redirect('/enterprise/demo');
}
