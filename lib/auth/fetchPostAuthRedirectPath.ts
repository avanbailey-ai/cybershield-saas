/** Client-safe helper — fetches server-computed post-auth redirect path. */
export async function fetchPostAuthRedirectPath(): Promise<string> {
  const res = await fetch("/api/auth/redirect-path", { credentials: "include" });
  if (!res.ok) {
    return "/app";
  }
  const data = (await res.json()) as { path?: string };
  return typeof data.path === "string" && data.path.startsWith("/")
    ? data.path
    : "/app";
}
