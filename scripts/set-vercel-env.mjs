import { spawnSync } from "node:child_process";

/**
 * Push Vercel production env vars from the local shell environment.
 * Usage (PowerShell):
 *   $env:NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
 *   $env:NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
 *   node scripts/set-vercel-env.mjs
 */
const updates = [
  ["NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY],
  [
    "NEXT_PUBLIC_SITE_URL",
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://cybershieldcloud.com",
  ],
];

for (const [name, value] of updates) {
  if (!value) {
    console.error(`${name}: SKIPPED — set in environment before running this script`);
    continue;
  }

  const result = spawnSync(
    "npx",
    ["vercel", "env", "add", name, "production", "--force"],
    {
      input: value,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
      cwd: process.cwd(),
    },
  );
  const ok = result.status === 0;
  console.log(`${name}: ${ok ? "updated" : "FAILED"}`);
  if (!ok && result.stderr) {
    console.error(result.stderr.trim().slice(0, 200));
  }
}
