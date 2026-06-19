/**
 * Add mail.cybershieldcloud.com to Resend, publish DKIM to Vercel DNS, verify.
 * Run: npx vercel env run --environment=production -- node scripts/setup-resend-mail-domain.mjs
 */
import { execSync } from "child_process";

const DOMAIN = "mail.cybershieldcloud.com";
const ROOT = "cybershieldcloud.com";

const key = process.env.RESEND_API_KEY?.trim();
if (!key || !key.startsWith("re_")) {
  console.error("RESEND_API_KEY missing or invalid. Set it in Vercel production env first.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

async function api(path, init = {}) {
  const res = await fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: { ...headers, ...init.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${path} ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

function dnsAdd(name, type, value, extra) {
  const args = extra
    ? `cybershieldcloud.com ${name} ${type} ${value} ${extra}`
    : `cybershieldcloud.com ${name} ${type} ${value}`;
  console.log(`DNS add: ${name} ${type}`);
  execSync(`npx vercel dns add ${args}`, { stdio: "inherit" });
}

const { data: domains } = await api("/domains");
let domain = domains?.find((d) => d.name === DOMAIN);

if (!domain) {
  console.log(`Creating Resend domain ${DOMAIN}...`);
  domain = await api("/domains", {
    method: "POST",
    body: JSON.stringify({ name: DOMAIN }),
  });
}

const detail = await api(`/domains/${domain.id}`);
const records = detail.records ?? [];

for (const record of records) {
  const host = record.name?.replace(`.${ROOT}`, "") ?? record.name;
  if (record.type === "MX") {
    dnsAdd(host, "MX", record.value.replace(/\.$/, ""), record.priority ?? 10);
  } else if (record.type === "TXT") {
    dnsAdd(host, "TXT", record.value);
  }
}

console.log("Verifying domain in Resend...");
const verified = await api(`/domains/${domain.id}/verify`, { method: "POST" });
console.log(JSON.stringify(verified, null, 2));
console.log("Done. Check Resend dashboard for verification status.");
