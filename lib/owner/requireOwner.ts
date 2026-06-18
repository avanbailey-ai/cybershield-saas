import { createClient } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/owner';
import type { User } from '@supabase/supabase-js';

export type OwnerAuthResult =
  | { ok: true; user: User }
  | { ok: false; status: 401 | 403 };

export async function requireOwner(): Promise<OwnerAuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, status: 401 };
  if (!isOwner(user.email)) return { ok: false, status: 403 };
  return { ok: true, user };
}
