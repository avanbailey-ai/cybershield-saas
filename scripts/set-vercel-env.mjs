import { spawnSync } from "node:child_process";

const updates = [
  ["NEXT_PUBLIC_SUPABASE_URL", "https://ezuihaqvbtqehjkzusjp.supabase.co"],
  [
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6dWloYXF2YnRxZWhqa3p1c2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzODM3NDYsImV4cCI6MjA5Njk1OTc0Nn0.as5tfXWUENKIfoKg67KkbRJ7DNnWwjb-kmQeSnIhIsk",
  ],
  ["NEXT_PUBLIC_SITE_URL", "https://cybershield-saas-1o19.vercel.app"],
];

for (const [name, value] of updates) {
  const result = spawnSync(
    "npx",
    ["vercel", "env", "add", name, "production", "--force"],
    {
      input: value,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
      cwd: process.cwd(),
    }
  );
  const ok = result.status === 0;
  console.log(`${name}: ${ok ? "updated" : "FAILED"}`);
  if (!ok && result.stderr) {
    console.error(result.stderr.trim().slice(0, 200));
  }
}
