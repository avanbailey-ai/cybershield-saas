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

/** Server/runtime check — reads NEXT_PUBLIC_* (with optional non-prefixed fallbacks at build). */
export function isSupabaseAuthConfigured(): boolean {
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    ""
  ).trim();
  const anonKey = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    ""
  ).trim();

  if (!url || !anonKey) return false;
  if (isPlaceholder(url) || isPlaceholder(anonKey)) return false;

  return isValidSupabaseUrl(url) && isValidAnonKey(anonKey);
}
