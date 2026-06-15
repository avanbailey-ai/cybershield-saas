import "server-only";

import { createClient } from "@supabase/supabase-js";

import {
  getSupabaseServiceRoleKey,
  requireSupabasePublicEnv,
  serviceRoleKeySetupHint,
  SupabaseEnvError,
} from "./env";

export function createAdminClient() {
  const { url } = requireSupabasePublicEnv();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!serviceRoleKey) {
    throw new SupabaseEnvError(
      `Supabase admin env missing. Set SUPABASE_SERVICE_ROLE_KEY. ${serviceRoleKeySetupHint()}`
    );
  }

  return createClient(url, serviceRoleKey);
}
