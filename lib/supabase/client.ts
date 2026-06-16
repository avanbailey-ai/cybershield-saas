import { createBrowserClient, type CookieOptions } from "@supabase/ssr";
import { parse, serialize } from "cookie";

import { mapSessionAuthCookies } from "./authCookies";
import { requireSupabasePublicEnv } from "./env";

export function createClient() {
  const { url, anonKey } = requireSupabasePublicEnv();
  return createBrowserClient(url, anonKey, {
    cookies: {
      getAll() {
        const parsed = parse(document.cookie);
        return Object.keys(parsed).map((name) => ({
          name,
          value: parsed[name] ?? "",
        }));
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        mapSessionAuthCookies(cookiesToSet).forEach(({ name, value, options }) => {
          document.cookie = serialize(name, value, options);
        });
      },
    },
  });
}
