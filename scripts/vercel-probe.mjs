import fs from 'fs';

const authPath = `${process.env.APPDATA}/xdg.data/com.vercel.cli/auth.json`;
const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
const token = auth.token;
const headers = { Authorization: `Bearer ${token}` };

async function api(path) {
  const res = await fetch(`https://api.vercel.com${path}`, { headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status} ${text}`);
  return JSON.parse(text);
}

const teams = await api('/v2/teams');
const teamId = teams.teams?.[0]?.id;
const projectId = 'prj_j0wGm9zjJcL9aTaugQlyu8IhZdwu';
const q = teamId ? `?teamId=${teamId}&decrypt=true` : '?decrypt=true';
const envs = await api(`/v10/projects/${projectId}/env${q}`);
const row = envs.envs.find((e) => e.key === 'STRIPE_SECRET_KEY');
console.log('sample keys', row ? Object.keys(row) : 'none');
console.log('value type', row?.value === undefined ? 'undefined' : typeof row.value);
console.log('value len', row?.value?.length ?? 0);
console.log('targets', row?.target);

// list preview deployments for branch
const deps = await api(`/v6/deployments?projectId=${projectId}&teamId=${teamId}&limit=5`);
for (const d of deps.deployments.slice(0, 5)) {
  console.log('deploy', d.meta?.githubCommitRef, d.url, d.readyState, d.meta?.githubCommitSha?.slice(0, 7));
}
