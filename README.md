# cybershield-saas

## CI Enforcement

Pull requests and pushes to `main`/`master` run `.github/workflows/ci-enforce.yml`:

1. **Layer enforcement** — `node scripts/enforce-layers.mjs --pr` (diff against base branch)
2. **Production build** — `npm run build`
3. **Scan smoke test** — `npm run smoke:scan` (calls `runScan` directly, no server)

Run locally: `npm run ci:check`

