# Founder OS Security & Access Audit

**Date:** 2026-06-18 (updated post Phase 1 fixes)  
**Scope:** Founder OS isolation from customer-facing CyberShield  
**Verdict:** **PASS** — functionally isolated with middleware defense-in-depth now in place

> **Phase 1 update:** Middleware now blocks non-owners from `/dashboard/admin/*`, `/dashboard/owner/*`, `/app/admin/*`, `/owner/*`, `/founder/*`, `/api/owner/*`, `/api/admin/*` as a second layer (`isOwnerOnlyPath` in `lib/supabase/middleware.ts`). The legacy `/dashboard/admin/ceo-dashboard` now enforces `isOwner` before redirect. Remaining item (RLS explicit policies) is documented below and is **deny-by-default safe** today.

---

## Executive summary

Founder OS is **owner-only** in practice. All `/api/owner/*` and `/api/admin/*` endpoints enforce owner identity before returning data. Admin pages gate on `isOwner()`. Customer, agency, and enterprise navigation does not surface Founder OS. **No fully exposed routes or APIs were found.**

Gaps are **defense-in-depth** (middleware does not pre-block admin paths), **database policy clarity** (owner tables have RLS enabled but no explicit policies), and **single-email owner model** (env-based, no DB role).

**Success criteria met for isolation:** Customers use CyberShield (`/app/*`). Only the configured owner account (`avanbailey@gmail.com` by default) can access Founder OS.

Static verification: `npx tsx scripts/verify-founder-os-security.ts`

---

## How owner identity is determined

| Mechanism | Location | Behavior |
|-----------|----------|----------|
| `OWNER_EMAIL` env var | `lib/auth/owner.ts` | Defaults to `avanbailey@gmail.com`; case-insensitive match |
| `isOwner(email)` | `lib/auth/owner.ts` | Returns true only for exact owner email |
| `requireOwner()` | `lib/owner/requireOwner.ts` | API guard: **401** unauthenticated, **403** non-owner |
| Page guard | Admin pages + `owner/layout.tsx` | Redirect non-owners to `/login` or `/dashboard` |
| Owner home | `lib/auth/ownerExperience.ts` | `/dashboard/admin/owner` |

There is **no database owner role**, **no multi-owner support**, and **no MFA hook** at the application layer.

---

## Access matrix

| Actor | Expected | Observed |
|-------|----------|----------|
| **Unauthenticated** | 403 or redirect | Pages → `/login` via `app/dashboard/layout.tsx`; APIs → **401** |
| **Normal customer** | 403 or redirect | Pages → `/login` (Founder OS) or `/dashboard`→`/app` (legacy admin pages); APIs → **403** |
| **Agency customer** | 403 or redirect | Same as normal customer |
| **Enterprise customer** | 403 or redirect | Enterprise portal OK; Founder OS blocked; APIs → **403** |
| **Owner** | Access granted | Full Founder OS; redirected away from customer surfaces |

Redirect targets differ (`/login` vs `/dashboard`) but **no sensitive data is returned** to non-owners.

---

## Route inventory (pages)

| Route | Protection | Status |
|-------|------------|--------|
| `/dashboard/admin/owner` | `owner/layout.tsx` + page `isOwner` | **Protected** |
| `/dashboard/admin` | page `isOwner` | **Protected** |
| `/dashboard/admin/analytics` | page `isOwner` | **Protected** |
| `/dashboard/admin/revenue-intelligence` | page `isOwner` | **Protected** |
| `/dashboard/admin/sales` | page `isOwner` | **Protected** |
| `/dashboard/admin/beta-reports` | page `isOwner` | **Protected** |
| `/dashboard/admin/monitoring` | page `isOwner` | **Protected** |
| `/dashboard/admin/ceo-dashboard` | redirect only (legacy) | **Partial** — no `isOwner` before redirect; target route blocks |
| `/app/admin/*` | middleware rewrite → `/dashboard/admin/*` | **Protected** (same checks) |
| `/founder/*`, `/owner/*`, `/dashboard/owner/*` | — | **N/A** (routes do not exist) |

### Exposed routes

**None (critical).** One partial: `/dashboard/admin/ceo-dashboard` (redirect-only legacy route).

---

## API inventory

### `/api/owner/*` — 41 routes

All routes call `requireOwner()` or equivalent `isOwner` check before using `createAdminClient()`.

High-sensitivity endpoints (all gated):

- `founder-os`, `founder-os-audit`, `revenue`, `customers`, `inbox`
- `outreach/[id]/send`, `prospects/*`, `discovery/*`
- `intelligence`, `insights`, `email/setup-mail-domain`, `test-email`
- `settings`, `crm`, `campaigns`, `automation-health`

### `/api/admin/*` — 8 routes

All routes check `isOwner(user.email)`:

- `ceo/analyze`, `ceo/apply`
- `autopilot/run`, `autopilot/apply`
- `brain/optimize`, `monitoring-logs`
- `migrate-orgs`, `backfill-org-intelligence`

### Missing auth / owner checks

| Item | Severity | Detail |
|------|----------|--------|
| `/dashboard/admin/ceo-dashboard` | **Low** | Redirect-only; no `isOwner` on page itself |
| Future routes without guard | **Medium** | No middleware safety net for `/api/owner/*` |

**No API routes currently missing owner guards.**

---

## Middleware analysis

**File:** `lib/supabase/middleware.ts` (Layer 0 — frozen; audit only)

**Does:**

- Session refresh
- Redirect signed-in **owners away** from customer paths (`shouldRedirectOwnerFromPath` → `OWNER_HOME_PATH`)
- `/dashboard` → `/app` rewrite (except `/dashboard/admin/*`)
- Enterprise portal gating

**Does not:**

- Block non-owners from `/dashboard/admin/*`
- Block non-owners from `/api/owner/*` or `/api/admin/*`

**Gap:** Protection is entirely per-route/per-page. A future route added without `requireOwner`/`isOwner` would be reachable until caught in review.

**Dev risk:** If Supabase env vars are missing, middleware may pass through unauthenticated (development-only).

---

## Navigation & client-side leak analysis

| Surface | Finding |
|---------|---------|
| `DashboardSidebar` | Admin links only when `showAdmin=true` |
| `app/dashboard/layout.tsx` | Owners short-circuit before `DashboardShell`; non-owners get `showAdmin={false}` |
| `EnterprisePortalShell` | `showOwnerTools={false}` hardcoded |
| `components/owner/*` | Only imported from `app/dashboard/admin/owner/page.tsx` |
| Client fetches | Owner components call `/api/owner/*` only from owner-gated pages |
| `app/sitemap.ts` | Does not list admin/founder routes |
| `app/robots.ts` | Disallows `/dashboard/`, `/app/`, `/api/` |

**URL guessing:** Non-owners hitting `/dashboard/admin/owner` get redirected before Founder OS data loads. API calls without owner session return 401/403 JSON — no prospect/revenue payload.

---

## RLS & data isolation

Owner tables (`owner_prospects`, `owner_crm_leads`, `owner_outreach_drafts`, `owner_email_deliveries`, `owner_founder_settings`, etc.):

- RLS **enabled** in migrations (`20260617200000_founder_os.sql` and follow-ons)
- **No explicit `CREATE POLICY`** on owner tables → JWT clients denied by default
- All Founder OS API routes use **service role** (`createAdminClient()`) **after** `requireOwner()`

**Enterprise vs Founder OS:** Enterprise portal is org-scoped RBAC. Founder OS is platform-owner-only. No nav overlap.

### Data leakage risks

| Risk | Severity | Mitigation today | Recommended |
|------|----------|------------------|-------------|
| Service role after weak API guard | **Critical if guard removed** | All routes guarded today | Middleware + shared admin layout |
| JWT client direct Supabase query | **Low** | RLS deny-by-default | Explicit owner-only policies |
| Owner email env misconfiguration | **Medium** | Deployment checklist | Document `OWNER_EMAIL`; consider JWT claim |

---

## Privilege escalation risks

| Risk | Severity | Detail |
|------|----------|--------|
| Single-email owner model | **Medium** | Compromise of owner account = full platform intelligence |
| No middleware on `/api/owner/*` | **Medium** | Missed guard on new route = immediate exposure |
| `ceo-dashboard` redirect chain | **Low** | Redirects to protected route; no data leak |
| Email tracking secret fallback | **Low** | `lib/email/tracking.ts` may fall back to weak dev secret; public open/click endpoints signature-gated |
| QA accounts (`is_qa_account`) | **Low** | Feature gates only; does not grant Founder OS access |

---

## Server actions

No server actions under `app/dashboard/admin/` or `app/actions/` were found that mutate owner data without going through `/api/owner/*`. Founder OS mutations are API-route-based.

---

## Recommendations (fix order)

1. **Middleware defense-in-depth** — Deny non-owners on `/dashboard/admin/*`, `/api/owner/*`, `/api/admin/*` (checkpoint branch; Layer 0 touch).
2. **Shared admin layout** — `app/dashboard/admin/layout.tsx` with centralized `isOwner` gate.
3. **Explicit RLS policies** — Owner tables: deny all except service role, or owner-email JWT claim.
4. **`ceo-dashboard` hardening** — Add `isOwner` check before redirect.
5. **Production secrets** — Require `EMAIL_TRACKING_SECRET`; remove dev fallback.
6. **Owner identity** — Document `OWNER_EMAIL` in deployment; consider Supabase custom claim for owner role.

---

## Manual verification checklist

Run after deploy with test accounts:

1. **Anonymous:** `curl /api/owner/founder-os` → 401; browser `/dashboard/admin/owner` → `/login`
2. **Free customer:** same API → 403; `/dashboard/admin/owner` → `/login`
3. **Agency customer:** same as free
4. **Enterprise admin:** `/enterprise/portal` → OK; `/dashboard/admin/owner` → blocked; `/api/owner/revenue` → 403
5. **Owner (`avanbailey@gmail.com`):** `/dashboard/admin/owner` loads Founder OS; `/api/owner/founder-os` → 200; customer `/app` redirects to Founder OS home

---

## Related docs

- `docs/full-system-audit.md` — platform-wide audit
- `docs/owner-dashboard-execution-audit.md` — Founder OS action execution
- `scripts/verify-founder-os.ts` — Founder OS feature verification (not security-focused)
