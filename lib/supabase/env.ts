const PLACEHOLDER_PATTERNS = [
  "your-project-ref",
  "your-anon-key-here",
  "placeholder",
] as const;

function isPlaceholder(value: string): boolean {
  const lower = value.toLowerCase();
  return PLACEHOLDER_PATTERNS.some((pattern) => lower.includes(pattern));
}

function isValidSupabaseUrl(url: string): boolean {
  return (
    (url.startsWith("https://") || url.startsWith("http://")) &&
    url.includes(".supabase.")
  );
}

function isValidAnonKey(key: string): boolean {
  if (key.length < 20) return false;
  // Legacy JWT anon key or newer publishable key
  return key.startsWith("eyJ") || key.startsWith("sb_publishable_");
}

/** Read public Supabase URL — prefers NEXT_PUBLIC_*, with build-time fallbacks. */
export function readSupabaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    ""
  ).trim();
}

/** Read anon/publishable key — prefers NEXT_PUBLIC_*, with legacy name fallbacks. */
export function readSupabaseAnonKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON ??
    process.env.SUPABASE_KEY ??
    ""
  ).trim();
}

export type SupabasePublicEnv = {
  url: string;
  anonKey: string;
};

export class SupabaseEnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseEnvError";
  }
}

/** Returns public env or null — never calls Supabase SDK. */
export function getSupabasePublicEnv(): SupabasePublicEnv | null {
  const url = readSupabaseUrl();
  const anonKey = readSupabaseAnonKey();

  if (!url || !anonKey) {
    console.error(
      "[supabase] Missing env: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
    return null;
  }

  return { url, anonKey };
}

/** Throws a clear error before Supabase SDK can emit "supabaseKey is required". */
export function requireSupabasePublicEnv(): SupabasePublicEnv {
  const env = getSupabasePublicEnv();
  if (!env) {
    throw new SupabaseEnvError(
      "Supabase client env missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  return env;
}

/** Where to configure the service role key (server-only, never NEXT_PUBLIC_). */
export function serviceRoleKeySetupHint(): string {
  if (process.env.VERCEL) {
    return "Add it in Vercel → Project Settings → Environment Variables (Production/Preview), then redeploy.";
  }
  return "Add it to .env.local for local dev (copy service_role from Supabase Dashboard → Settings → API for project ezuihaqvbtqehjkzusjp), then restart `npm run dev`.";
}

/** Server-only — never use in browser/client components. */
export function getSupabaseServiceRoleKey(): string | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    console.error(
      `[supabase] Missing env: SUPABASE_SERVICE_ROLE_KEY. ${serviceRoleKeySetupHint()}`
    );
    return null;
  }
  return key;
}

/** Server/runtime check — reads NEXT_PUBLIC_* (with optional non-prefixed fallbacks at build). */
export function isSupabaseAuthConfigured(): boolean {
  const url = readSupabaseUrl();
  const anonKey = readSupabaseAnonKey();

  if (!url || !anonKey) return false;
  if (isPlaceholder(url) || isPlaceholder(anonKey)) return false;

  return isValidSupabaseUrl(url) && isValidAnonKey(anonKey);
}
