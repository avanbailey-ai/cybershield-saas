import fs from 'fs';

const auth = JSON.parse(
  fs.readFileSync(`${process.env.APPDATA}/xdg.data/com.vercel.cli/auth.json`, 'utf8'),
);
const teamId = 'team_gtd3zKNPLnEEb4UZ5mQNv27R';
const projectId = 'prj_j0wGm9zjJcL9aTaugQlyu8IhZdwu';

// Allow Stripe webhooks to hit Preview URLs (Production protection unchanged).
const res = await fetch(`https://api.vercel.com/v9/projects/${projectId}?teamId=${teamId}`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${auth.token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    ssoProtection: null,
  }),
});
const text = await res.text();
console.log('status', res.status);
if (!res.ok) {
  console.log(text.slice(0, 500));
  process.exit(1);
}
const data = JSON.parse(text);
console.log('updated ssoProtection', data.ssoProtection);
