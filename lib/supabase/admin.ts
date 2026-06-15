import { createClient } from "@supabase/supabase-js";

import {
  getSupabaseServiceRoleKey,
  requireSupabasePublicEnv,
  SupabaseEnvError,
} from "./env";

export function createAdminClient() {
  const { url } = requireSupabasePublicEnv();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!serviceRoleKey) {
    throw new SupabaseEnvError(
      "Supabase admin env missing. Set SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(url, serviceRoleKey);
}
