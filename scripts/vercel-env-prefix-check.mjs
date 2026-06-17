import fs from 'fs';

const authPath = `${process.env.APPDATA}/xdg.data/com.vercel.cli/auth.json`;
const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
const token = auth.token;
const headers = { Authorization: `Bearer ${token}` };

async function api(path) {
  const res = await fetch(`https://api.vercel.com${path}`, { headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status} ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

function prefix(v) {
  if (!v) return 'MISSING';
  if (v.startsWith('sk_live_')) return 'sk_live_';
  if (v.startsWith('sk_test_')) return 'sk_test_';
  if (v.startsWith('pk_live_')) return 'pk_live_';
  if (v.startsWith('pk_test_')) return 'pk_test_';
  if (v.startsWith('whsec_')) return 'whsec_';
  if (v.startsWith('price_')) return `price_(${v.length}c)`;
  if (v.startsWith('http')) return v.replace(/\/$/, '');
  return `SET(${v.length}c)`;
}

const user = await api('/v2/user');
const teams = await api('/v2/teams');
const teamId = teams.teams?.[0]?.id ?? null;
const q = teamId ? `?teamId=${teamId}` : '';
const projects = await api(`/v9/projects${q}`);
const project = projects.projects.find((p) => p.name.includes('cybershield'));
if (!project) throw new Error('project not found');

console.log('project', project.name, project.id, 'team', teamId ?? 'personal');

const envs = await api(`/v10/projects/${project.id}/env${teamId ? `?teamId=${teamId}` : ''}`);
for (const row of envs.envs) {
  if (!row.key.startsWith('STRIPE') && row.key !== 'NEXT_PUBLIC_SITE_URL' && row.key !== 'CRON_SECRET') continue;
  let val = row.value ?? row.decrypted ?? '';
  if (!val && row.id) {
    try {
      const one = await api(
        `/v10/projects/${project.id}/env/${row.id}${teamId ? `?teamId=${teamId}&decrypt=true` : '?decrypt=true'}`,
      );
      val = one.value ?? one.decrypted ?? '';
    } catch {
      val = '';
    }
  }
  console.log(`${row.key} [${(row.target ?? []).join(',')}] => ${prefix(val)} id=${row.id}`);
}
