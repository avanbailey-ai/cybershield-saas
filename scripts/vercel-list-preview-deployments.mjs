import fs from 'fs';

const auth = JSON.parse(
  fs.readFileSync(`${process.env.APPDATA}/xdg.data/com.vercel.cli/auth.json`, 'utf8'),
);
const teamId = 'team_gtd3zKNPLnEEb4UZ5mQNv27R';
const projectId = 'prj_j0wGm9zjJcL9aTaugQlyu8IhZdwu';

const res = await fetch(
  `https://api.vercel.com/v6/deployments?projectId=${projectId}&teamId=${teamId}&limit=5&target=preview`,
  { headers: { Authorization: `Bearer ${auth.token}` } },
);
const data = await res.json();
for (const d of data.deployments ?? []) {
  const branch = d.meta?.githubCommitRef ?? d.meta?.gitlabCommitRef ?? '?';
  console.log(d.url, 'state=' + d.readyState, 'branch=' + branch, 'sha=' + (d.meta?.githubCommitSha ?? '').slice(0, 7));
}
