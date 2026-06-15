# CyberShield Operating Model

Safe Layered Development System — human workflow and enforcement tooling.

## Checkpoint Rule

When work spans **multiple systems or layers**, create a dedicated branch:

```bash
git checkout -b checkpoint/<short-name>
```

Examples: `checkpoint/dashboard-queue-fix`, `checkpoint/stripe-portal-ui`

Merge only after each layer is validated. Single-layer bug fixes do not require a checkpoint branch.

## Layer Table

| Layer | Scope | Status |
|-------|-------|--------|
| **0** | Auth, Stripe webhooks, scan queue (`processQueue`, `trigger-all`, `process-queue`), Supabase middleware | **LOCKED** |
| **1** | Scan API route, `services/`, `core/scans/`, `core/billing/` | ACTIVE |
| **2** | `lib/reliability/`, `lib/workers/`, `app/api/cron/` | ACTIVE |
| **3** | `components/`, landing/login/signup/dashboard pages | ACTIVE |
| **4** | Meta tooling: `scripts/`, `.cursor/rules/`, this doc | ACTIVE |
| **5** | Analytics, conversion, growth experiments | ACTIVE |
| **6** | Enterprise portal, admin dashboards | ACTIVE |

**Rule:** One layer group (0–3) per session. Layer 4 tooling is always safe to add without touching business logic.

## Workflow

1. **Identify layer** — Which layer does the task belong to?
2. **Confirm isolation** — List files you will touch; ensure they stay in one layer group.
3. **Checkpoint if needed** — Cross-layer work → `checkpoint/<name>` branch.
4. **Implement** — Respect dependency flow: UI → API → Core → Services → DB.
5. **Enforce before commit** — Run layer check on staged files.
6. **Build** — `npm run build` must pass.

## Layer Enforcement

Check staged files before commit:

```bash
npm run enforce:layers:staged
```

Check specific files:

```bash
npm run enforce:layers -- --files app/dashboard/page.tsx,components/dashboard/Foo.tsx
```

No git / no flags:

```bash
npm run enforce:layers
# → OK, no files to check
```

On violation the script exits 1:

```
CROSS-LAYER VIOLATION: files touch layers 0 and 3. Create checkpoint/<name> branch or split changes.
```

## Rollback

Stable baseline: branch **`stable-checkpoint`**

Restore a single file:

```bash
git checkout stable-checkpoint -- path/to/file
```

Full rollback to last stable state:

```bash
git checkout stable-checkpoint
```

## Optional Pre-Commit Hook

No Husky required. Wire manually:

**Option A — hooks path (project-local):**

```bash
mkdir -p .githooks
echo '#!/bin/sh\nnpm run enforce:layers:staged' > .githooks/pre-commit
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks
```

**Option B — manual:** run `npm run enforce:layers:staged` before every commit.

On Windows, use a `.githooks/pre-commit` script that calls `node scripts/enforce-layers.mjs --staged`.

## Frozen Core (Layer 0)

Do not modify without explicit authorization on a checkpoint branch:

- Supabase auth & session middleware
- Stripe webhook and checkout routes
- Scan queue processing (`trigger-all`, `process-queue`, `processQueue.ts`, `queue.ts`)
- Realtime dashboard data flows tied to the queue

Meta tooling (this enforcement layer) is intentionally outside Layer 0 business logic.
