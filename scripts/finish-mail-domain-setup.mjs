import { execSync } from "child_process";

const ROOT = "cybershieldcloud.com";
const MAIL = "mail.cybershieldcloud.com";

const apiKey = process.argv[2]?.trim();
if (!apiKey?.startsWith("re_")) {
  console.error("Usage: node scripts/finish-mail-domain-setup.mjs re_your_api_key");
  console.error("Use the same RESEND_API_KEY value from Vercel production.");
  process.exit(1);
}

const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.cybershieldcloud.com";

console.log("Calling production setup endpoint…");
const res = await fetch(`${site}/api/cron/setup-mail-domain`, {
  method: "POST",
  headers: { Authorization: `Bearer ${apiKey}` },
});
const body = await res.json().catch(() => ({}));
if (!res.ok || !body.ok) {
  console.error("Setup failed:", res.status, body);
  process.exit(1);
}

console.log(`Resend domain: ${body.domainName} (${body.status})`);

function dnsAdd(name, type, value, extra) {
  const args = extra
    ? `${ROOT} ${name} ${type} ${value} ${extra}`
    : `${ROOT} ${name} ${type} ${value}`;
  console.log(`Adding DNS: ${name} ${type}`);
  try {
    execSync(`npx vercel dns add ${args}`, { stdio: "inherit" });
  } catch {
    console.log(`Skipped or failed (may already exist): ${name} ${type}`);
  }
}

for (const record of body.vercelDnsNames ?? []) {
  if (record.type === "MX") {
    dnsAdd(record.name, "MX", record.value.replace(/\.$/, ""), record.priority ?? 10);
  } else if (record.type === "TXT") {
    dnsAdd(record.name, "TXT", record.value);
  }
}

console.log("Done. DKIM should propagate within minutes; check Resend dashboard for verified status.");
