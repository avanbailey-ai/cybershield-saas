import type { CookieOptions } from "@supabase/ssr";

/** Supabase auth token cookies (e.g. sb-<ref>-auth-token). */
export function isSupabaseAuthCookie(name: string): boolean {
  return name.includes("-auth-token");
}

/** Strip maxAge/expires so the cookie expires when the browser session ends. */
export function asSessionCookieOptions(
  name: string,
  options: CookieOptions,
): CookieOptions {
  if (!isSupabaseAuthCookie(name)) {
    return options;
  }
  const { maxAge: _maxAge, expires: _expires, ...sessionOpts } = options;
  return sessionOpts;
}

type CookieToSet = { name: string; value: string; options: CookieOptions };

export function mapSessionAuthCookies(cookies: CookieToSet[]): CookieToSet[] {
  return cookies.map(({ name, value, options }) => ({
    name,
    value,
    options: asSessionCookieOptions(name, options),
  }));
}
