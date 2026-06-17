import fs from 'fs';

const auth = JSON.parse(
  fs.readFileSync(`${process.env.APPDATA}/xdg.data/com.vercel.cli/auth.json`, 'utf8'),
);
const teamId = 'team_gtd3zKNPLnEEb4UZ5mQNv27R';
const projectId = 'prj_j0wGm9zjJcL9aTaugQlyu8IhZdwu';

const res = await fetch(`https://api.vercel.com/v9/projects/${projectId}?teamId=${teamId}`, {
  headers: { Authorization: `Bearer ${auth.token}` },
});
const project = await res.json();
console.log('ssoProtection', project.ssoProtection);
console.log('passwordProtection', project.passwordProtection);
console.log('optionsAllowlist', project.optionsAllowlist?.length ?? 0);
