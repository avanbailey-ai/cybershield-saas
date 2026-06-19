import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** Legacy plural URL — canonical agency landing is /agency */
export default async function AgenciesRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) q.append(key, v);
    } else if (value != null) {
      q.set(key, value);
    }
  }
  const qs = q.toString();
  redirect(qs ? `/agency?${qs}` : '/agency');
}
