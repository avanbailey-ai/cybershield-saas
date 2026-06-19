# CyberShield Cloud — Full Product QA, Revenue & Mobile Audit

**Scope:** Code-level production audit of CyberShield Cloud (Next.js App Router cybersecurity SaaS) with focus on the newly merged owner-only **Founder OS** agency prospect discovery & outreach system.
**Branch / commit:** `main` @ `a693dad` (clean tree at start).
**Mode:** AUDIT ONLY. No existing source files modified. No emails sent. No outreach approved. No Stripe/Resend config changed. Two new deliverables created (this doc + `scripts/verify-product-qa-invariants.ts`), left uncommitted.
**Production URL audited:** https://www.cybershieldcloud.com (deploy `a693dad`).
**Pricing model under review:** Pro $79/mo · Growth $149/mo · Agency $299/mo · Enterprise (custom).

> Live browser QA (anonymous + authenticated owner/agency) merged below. QA simulation account (`test@gmail.com`) login **blocked** — Supabase returned "Invalid login credentials" with the provided password; password reset requires `SUPABASE_SERVICE_ROLE_KEY` via `scripts/reset-qa-account-password.ts`.

---

## 1. Executive Summary

CyberShield Cloud is a structurally mature, multi-tenant website-security SaaS with a sophisticated, **owner-only** growth engine ("Founder OS") layered on top of the customer product. The recently merged **agency prospect discovery & outreach system** is well-isolated, correctly gated, and code-clean:

- **Access isolation is strong.** All 38 `/api/owner/*` routes and all 8 `/api/admin/*` routes enforce an owner guard; the Founder OS page + layout re-check `isOwner`; and `middleware.ts` adds a defense-in-depth deny on every owner-only path. Customer-facing navigation contains no links to owner/founder/prospect surfaces.
- **Outreach is human-gated.** There is **no auto-send path**. Email only leaves the system through two owner-gated, explicit-approval surfaces (the `[id]/send` route and the Founder OS inbox "Approve" action). No cron/background job sends outreach.
- **The known reliability fixes are intact.** Follow-up dedupe (idempotent scheduler + no-cascade guard + DB partial unique index) and agency/SMB separation (`prospect_kind`, separate generators, NOT-AGENCY-FIT → `smb`) all verify green.
- **Copy honesty holds.** The free tier is explicitly framed as a one-time preview with **no continuous monitoring**, and outreach copy passes the existing quality gate (no raw scanner findings, calm disclaimer, low-pressure CTA).
- **Email deliverability is correctly configured** around the verified root sender (`outreach@cybershieldcloud.com`); the unverified mail subdomain is intentionally disabled and treated as healthy.

**The biggest gaps are revenue/conversion, not safety.** The agency outreach CTA drops prospects onto a generic `/signup?plan=agency` page that **does not read the `plan=agency` param** and offers no agency-specific context — there is no `/agencies` or `/agency` landing page. The public scan→signup funnel sends cold prospects straight to account creation rather than a prospect-specific summary. These are the highest-leverage fixes before scaling outreach.

**One environmental issue:** `npm run build` fails with a V8 out-of-memory crash (`Zone Allocation failed`) during the lint/type-check worker phase. Compilation succeeds and `npx tsc --noEmit` passes clean, so this is a host memory constraint, not a code defect.

---

## 2. Beta Readiness Verdict

**Verdict: READY for a small, controlled beta outreach — with two pre-conditions.**

Code-level invariants confirm the system is structurally safe to begin limited, manually-approved outreach:

| Readiness dimension | Status | Evidence |
|---|---|---|
| Owner-only isolation | ✅ Ready | 38/38 owner APIs + 8/8 admin APIs guarded; middleware deny; layout/page re-check |
| No accidental sends | ✅ Ready | No auto-send path; 2 owner-gated approval surfaces only; no cron send |
| Follow-up runaway prevention | ✅ Ready | Idempotent scheduler + no-cascade guard + DB unique index |
| Agency/SMB segmentation | ✅ Ready | `prospect_kind`, separate generators, NOT-FIT → `smb` |
| Metric integrity (internal/QA excluded) | ✅ Ready | `isInternalCustomerProfile` + `is_qa_account` in metrics |
| Copy honesty / no false promises | ✅ Ready | Free = one-time preview; copy quality gate green |
| Deliverability config | ✅ Ready | Verified root sender; subdomain disabled & healthy |
| **Agency conversion path** | ⚠️ Pre-condition | No agency landing; `/signup?plan=agency` ignores the param |
| **Build pipeline** | ⚠️ Pre-condition | `next build` OOMs in type-check worker (environmental) |
| Mobile UX (public pages) | ✅ Ready | iPhone/Android 7–9/10; tablet 9/10; no critical breakage |
| Mobile UX (dashboards) | ⚠️ Partial | Owner + customer dashboards not fully mobile-audited (QA login blocked) |
| QA simulation account | ⚠️ Blocked | `test@gmail.com` credentials rejected at `/login` — reset needed before customer QA pass |

**Pre-conditions before *scaling* (not before a tiny test batch):**
1. Give agency prospects a real destination (agency landing page or at minimum a `plan=agency`-aware signup), so the $299 CTA does not waste hard-won clicks.
2. Resolve or contain the build OOM so deploys are reproducible.

For a **first controlled batch (e.g. ≤ 10–20 hand-reviewed agency prospects)**, the safety guarantees are sufficient today.

---

## 3. Owner / Founder OS Audit (page-by-page)

Founder OS is a single owner-gated surface at `/dashboard/admin/owner` rendering `components/owner/FounderOs.tsx`, organized into sections from `lib/owner/founderNav.ts`: **Home, Inbox, Prospects, Success, Customers, Settings**. Ratings combine code review + **live production walkthrough** (owner session, Jun 19 2026).

| Section / Surface | Usefulness | Revenue impact | Clarity | Trustworthiness | Actionability | Live production notes |
|---|---|---|---|---|---|---|
| **Home** | 8 | 8 | 7 | 7 | 8 | MRR $299, 1 paying customer, 5 inbox items pending approval, verified root sender healthy, follow-up worker healthy. CEO snapshot useful; some metric tension vs Customers page. |
| **Inbox** | 9 | 9 | 8 | 9 | 9 | Manual **Approve & Send** only — no auto-send observed. 5 items awaiting approval. Highest-leverage surface confirmed live. |
| **Prospects** | 8 | 8 | 7 | 8 | 8 | Agency discovery mode toggle + SMB/Agency filters work. **Agency Prospects filter empty** (no agency-classified prospects in prod yet). SMB pipeline populated. |
| **Success** | 7 | 8 | 7 | 7 | 7 | Shows `avanbailey711@gmail.com` Agency $299/mo healthy. Contradicts Customers empty state (see B6). |
| **Customers** | 6 | 7 | 5 | 6 | 6 | **"No paying customers yet"** while Home/Success show $299 MRR + 1 customer — test/agency account likely excluded from directory but counted elsewhere. Trust issue for founder decisions. |
| **Email intelligence** | 6 | 5 | 6 | 5 | 6 | **350% open rate** on 2 sends — metrics bug (opens > sends). Undermines trust in email analytics. |
| **Settings** | 8 | 6 | 8 | 9 | 8 | Safety dials (`require_approval`, limits, cooldown) present and clear. |
| **Outreach generator / approval** | 9 | 9 | 8 | 9 | 9 | Separate SMB/agency generators; calm copy; tracked CTA — confirmed in code + inbox UI. |
| **Autopilot** | 6 | 6 | 6 | 7 | 6 | Does not auto-send (verified). Naming may over-promise. |
| **Owner gating (anonymous)** | — | — | — | 10 | — | `/dashboard/admin/owner` → login redirect; `/api/owner/*` → 401. Confirmed after sign-out. |

**Owner-money takeaways:**
- The **Inbox** is the single highest-leverage owner surface and is correctly built around explicit approval. Protect this invariant.
- Prospects + Outreach generator are strong and segment agency vs SMB correctly.
- "Autopilot" is safe today but is the area to watch — any future change that lets it call `executeInboxApproval`/`sendApprovedOutreach` would convert a manual system into an auto-send system. The new invariant script guards exactly this.

---

## 4. Customer App Audit (code + live)

**Routes present (mobile-critical):** landing (`app/page.tsx`), pricing, signup, login, dashboard, free scan (`app/scan`), report (`app/report/[id]`), scan result (`app/scan-result/[id]`), plus dashboard sub-pages (websites, scans, alerts, reports, settings, referrals) and the enterprise portal.

### Live authenticated sessions (production)

| Persona | Login | Post-login destination | Founder OS access | Key observations |
|---|---|---|---|---|
| **Agency customer** (`avanbailey711@gmail.com`) | ✅ | `/enterprise/portal` | ❌ Blocked (stays on portal when hitting `/dashboard/admin/owner`) | Agency badge, 2 client sites, score 53/100. **"Websites protected: 0"** contradicts 2 sites listed — UX inconsistency. |
| **QA simulation** (`test@gmail.com`) | ❌ | — | — | "Invalid login credentials" — password not synced in Supabase auth; blocks standard `/app` dashboard QA pass. |
| **Anonymous** | — | Public pages + free scan | ❌ | Owner routes/APIs correctly gated. |

**Flows (code-level):**
- **Acquisition:** Home → `ScanInput` (free scan) → `/scan-result/[id]` → `/pricing` → Stripe checkout. The funnel state (`scanned_site`, `score`, `issue_count`) is threaded into Pricing for personalized headlines — good conversion craft.
- **Auth:** `middleware.ts` cleanly separates public, protected (`/app`, `/enterprise/portal`), auth, and owner paths; legacy `/dashboard/*` → `/app/*` redirects (308). Owner is redirected to Founder OS on auth paths.
- **Billing:** Pricing pulls display amounts dynamically from Stripe (`useDisplayPrices`) with `RECOMMENDED_PLAN_PRICES_USD` (79/149/299) as the source-of-truth fallback. Checkout posts to `/api/stripe/checkout`; 401 routes to signup with `redirectTo`.

**Copy honesty:** Strong. The free tier is labeled *"One-time preview only — top 3 findings shown, no continuous monitoring"* (Pricing UI) and *"No automated monitoring"* (`planFeatures`). Pro/Growth/Agency monitoring claims match plan limits (daily/hourly/multi-site). Enterprise is correctly "no self-serve pricing." This passes the free-copy-honesty invariant.

**Gaps:**
- Signup copy and bullets are generic; they do not adapt to a prospect arriving from outreach (or to `plan=agency`).
- `/scan-result/[id]` → `/pricing` is a reasonable funnel but lacks a prospect-specific summary page (see §10/§12).

---

## 5. Agency Flow Audit

**Classification (`lib/owner/agency/agencyDetect.ts` + `agencyEnrichment.ts`):** Signals are extracted from public HTML (manages client sites, portfolio, testimonials, service packages, maintenance/care plans, hosting, platforms, estimated site count). Network fetch is guarded by `isRejectedWebsite()` (no example/localhost/test hosts). Classification runs **before** the auto-scan/draft step in `discovery/engine.ts` (FIX 1) so agency prospects never get a premature SMB draft.

**Scoring (`agencyScore.ts`):** A dedicated `computeAgencyOpportunityScore` (separate from SMB `computeOpportunityScore`) with transparent, weighted signals and a human-readable `buildAgencyWhySelected` rationale. Labels: AGENCY HOT / WARM / LOW / NOT AGENCY FIT. **Understandability: strong** — every score carries a "Selected as a … because it …" sentence. `AGENCY_PLAN_PRICE = 299` ties revenue estimates to the real Agency tier.

**Segmentation (`decideProspectKind`):** Conservative and correct — HOT/WARM → `agency`; LOW → `agency` only with real manages-client-sites evidence; NOT-FIT → `smb` (FIX 2). Verified statically and at runtime.

**Draft copy strength (`agencyOutreach.ts`):** Excellent. Leads with the agency's business (not raw scanner findings), explains CyberShield as client-site monitoring + reporting infrastructure, includes 2–3 factual observations, mentions the Agency plan naturally ($299/mo), and ends with a low-pressure tracked CTA. Passes the outreach copy quality gate.

**CTA link (`prospectAttribution.buildAgencyAttributionUrl`):** `…/signup?plan=agency&source=agency_outreach&prospect=TOKEN`. The token is captured into a 30-day attribution cookie by `middleware.ts` and resolved at signup (`captureSignupAttribution`) and on paid conversion (`reconcilePaidConversions`). Attribution plumbing is solid.

**$299 value framing:** The agency email and the public `AgencySection` both articulate multi-site monitoring, client-ready reports, and priority checks — a coherent value story for $299/mo.

### `/agencies` vs `/agency` routing — KEY FINDING

- There is **no `app/agencies/` route and no `app/agency/` route**. A direct visit to `/agencies` or `/agency` would **404**.
- The public "Agencies" nav link points to **`/#agencies`** (an in-page anchor in `components/landing/AgencySection.tsx`, which renders `id="agencies"` on the homepage). That anchor works **only on the homepage**; the section CTAs route to `/pricing` and `/enterprise`.
- The **agency outreach CTA** sends prospects to **`/signup?plan=agency`**, but:
  - `app/signup/page.tsx` / `SignupForm` **do not read `plan=agency`** — the param is effectively ignored.
  - The Pricing component only honors `plan=pro|growth` for highlighting; `plan=agency` is not handled there either.
  - So an agency prospect who clicks the email lands on a **generic signup form with no agency context, no $299 plan pre-selection, and no agency value reinforcement**.

**Is a landing page needed before agency outreach?** **Yes — strongly recommended before scaling.** The current path converts a warm, well-segmented agency click into a cold, generic signup. A dedicated `/agencies` landing page (or, minimally, a `plan=agency`-aware signup/pricing experience) is the single biggest conversion fix for the agency motion. It is not a hard blocker for a tiny test batch, but it caps ROI on every agency email sent.

---

## 6. Mobile Audit (live production)

Tested on production at https://www.cybershieldcloud.com (read-only, one harmless `example.com` free scan).

### iPhone (390×844)

| Page | Score | Notes |
|---|---|---|
| Landing `/` | 7/10 | Clean hero, readable terminal mockup, good CTAs, cards stack well, no horizontal scroll, ≥44px tap targets; body text slightly small |
| Pricing `/pricing` | 8/10 | Cards stack vertically; clear pricing; tap-friendly CTAs |
| Signup `/signup` | 9/10 | Proper field sizing; Google SSO accessible |
| Login `/login` | 9/10 | Clean form; forgot-password link visible |
| Free scan input | 8/10 | Adequate input width; tap-friendly scan button |
| Free scan in-progress | 8/10 | Clear stage indicator ("Stage 1 of 3") |
| Free scan results | 7/10 | Score prominent; upgrade CTAs present; some finding text truncated |

**Flags:** None critical.

### Android (360×800)

| Page | Score | Notes |
|---|---|---|
| Landing | 7/10 | Same as iPhone; slightly narrower, no breakage |
| Pricing | 8/10 | Cards stack; personalized banner visible |
| Free scan results | 7/10 | Usable; same truncation as iPhone |

**Flags:** None.

### Tablet (768×1024)

| Page | Score | Notes |
|---|---|---|
| Landing | 9/10 | Full horizontal nav; side-by-side hero |
| Pricing | 9/10 | More breathing room; cards partially side-by-side |

**Flags:** None. Tablet experience excellent.

### Not yet mobile-verified (blocked or out of scope)

- **Founder OS** — dense full-screen shell; owner-only; not tested at mobile breakpoints in this pass.
- **Customer `/app` dashboard** — QA account login blocked.
- **Enterprise portal** — logged in at desktop only.

### Free scan flow (example.com) — live

- Completed end-to-end; score shown with HIGH-severity findings prioritized.
- **"Fix this first"** signal present (Missing CSP called out).
- Upgrade CTAs for Pro ($79) and Growth ($149) clear; recurring vs one-time conveyed via "43% coverage unlocked" / "unlock remaining 57%".
- **Weakness:** free-vs-paid monitoring distinction could be more prominent; some descriptions truncated.

### Break testing — live

| Scenario | Result |
|---|---|
| Invalid URL (`not a url`) | ✅ Backend error banner: "Invalid URL format" |
| Empty scan input | ✅ Client validation: "Please enter a URL" |
| `/signup?prospect=` | ✅ Loads cleanly; no crash/leak |
| `/signup?plan=agency&source=agency_outreach&prospect=` | ✅ Loads cleanly; **no agency context shown** (confirms B1) |
| `/agencies`, `/agency` | ✅ 404 (confirms B1) |
| Refresh mid-scan / back button | ⏭ Not tested |

---

## 7. Broken Flows / Bugs (code-level)

| # | Severity | Finding | Evidence |
|---|---|---|---|
| B1 | High (revenue) | Agency CTA → `/signup?plan=agency` but signup/pricing ignore `plan=agency`; no `/agencies` or `/agency` route (404 on direct visit). Warm agency clicks land on generic signup. | `prospectAttribution.buildAgencyAttributionUrl`, `app/signup/page.tsx`, `components/landing/Pricing.tsx` (handles only `pro`/`growth`), no `app/agencies` dir |
| B2 | Medium (infra) | `npm run build` OOMs (`Zone Allocation failed - process out of memory`) in the lint/type-check worker. Compilation succeeds; `tsc --noEmit` passes clean. Environmental, not code. | Build log; clean `tsc --noEmit` |
| B3 | Low | Edge Runtime warning: `@supabase/supabase-js` uses `process.version`, imported via `lib/supabase/middleware.ts`. Pre-existing, non-fatal. | Build warnings |
| B4 | Low (UX) | "Autopilot" naming implies automation but only applies whitelisted config + analysis (no auto-send). Could mislead the owner into expecting hands-off sending. | `app/api/admin/autopilot/{run,apply}/route.ts`, `lib/owner/inboxAutomation.ts` |
| B5 | Low | Public "Agencies" nav link is a homepage anchor (`/#agencies`); from non-home pages it requires a full navigation back to `/`. No standalone agency page to deep-link in outreach. | `components/landing/Navbar.tsx`, `AgencySection.tsx` |
| B6 | Medium (trust) | Founder OS **Customers** shows "No paying customers yet" while **Home/Success** show $299 MRR and 1 paying customer. Internal/test exclusion logic inconsistent across views. | Live owner session |
| B7 | Medium (trust) | Email intelligence shows **350% open rate** on 2 sends (opens counted > sends). | Live owner session |
| B8 | Low (UX) | Enterprise portal **"Websites protected: 0"** while 2 client sites listed. | Live agency customer session |
| B9 | Medium (QA) | QA account `test@gmail.com` cannot log in — blocks simulated-plan customer QA. Reset via `scripts/reset-qa-account-password.ts` + service role. | Live login attempt |
| B10 | Low (data) | Agency Prospects filter empty in production — no agency-classified discovery results yet (expected until first agency discovery run). | Live owner Prospects view |

No correctness bugs were found in the agency classification, scoring, segmentation, dedupe, or approval logic.

---

## 8. Security / Access Findings

| Area | Finding | Status |
|---|---|---|
| Owner gating (API) | 38/38 `/api/owner/*` and 8/8 `/api/admin/*` routes call `requireOwner`/`isOwner`. | ✅ |
| Owner gating (UI) | Founder OS `layout.tsx` + `page.tsx` re-check `isOwner` and redirect; all `/dashboard/admin` pages enforce `isOwner`. | ✅ |
| Middleware defense-in-depth | `isOwnerOnlyPath` denies non-owners on `/dashboard/admin`, `/api/owner`, `/api/admin` (401/403 for APIs, redirect for pages). | ✅ |
| Customer nav isolation | Landing/dashboard/enterprise nav contain no owner/founder/prospect links; dashboard layout short-circuits owners and gates the Admin entry on the owner flag. | ✅ |
| No auto-send | `sendApprovedOutreach` reachable only from the owner send route + owner inbox approve action; no cron path sends; draft creation always `status:'draft'`. | ✅ |
| Approval enforcement | `sendApprovedOutreach` returns "Approval required before send" unless `approved===true` and `require_approval` honored. | ✅ |
| Follow-up dedupe | Idempotent scheduler (`existingStages`), no-cascade guard (`outreach_type !== 'follow_up'`), DB partial unique index `uniq_owner_follow_ups_active_stage`. | ✅ |
| Agency/SMB separation | `prospect_kind` column + separate generators + `decideProspectKind` NOT-FIT → `smb`. | ✅ |
| Metrics exclusion | `isInternalCustomerProfile` + `is_qa_account` filter founder metrics; send pipeline refuses internal/test emails and existing customers. | ✅ |
| Send-safety guards | Cooldown (30d), daily limit, archived/ignored skip, scan-completed requirement, valid-email check, internal/customer exclusion. | ✅ |
| Secrets | No secrets present in the new deliverables; email/Stripe config read from env at runtime; sandbox fallbacks guarded. | ✅ |
| Attribution token safety | Tokens validated (`isValidAttributionToken`), single-use binding to user, cookie `sameSite=lax`. | ✅ |

**Net:** The security posture for the merged system is strong. The single thing to actively protect is the **no-auto-send invariant** around Autopilot/Inbox — now codified in `scripts/verify-product-qa-invariants.ts`.

---

## 9. Page-by-Page Ratings (consolidated)

Scale 1–10. **Mobile** column from live iPhone/Android/tablet pass where tested.

| Page / Surface | Usefulness | Revenue | Clarity | Trust | Actionability | Mobile | Notes |
|---|---|---|---|---|---|---|---|
| Landing (`/`) | 9 | 9 | 9 | 8 | 8 | 7–9 | Strong funnel; terminal demo effective |
| Free Scan + Results | 9 | 9 | 8 | 8 | 8 | 7–8 | example.com E2E pass; upgrade CTAs strong |
| Pricing (`/pricing`) | 9 | 9 | 9 | 9 | 9 | 8–9 | Ignores `plan=agency` |
| Signup (`/signup`) | 7 | 7 | 8 | 8 | 7 | 9 | Generic; attribution param captured but no UI |
| Login (`/login`) | 7 | 4 | 8 | 8 | 7 | 9 | Works for owner/agency; QA account blocked |
| Customer Dashboard (`/app`) | — | — | — | — | — | — | **Not audited** (QA login blocked) |
| Enterprise Portal | 8 | 8 | 7 | 7 | 8 | — | Agency customer OK; protected-count bug |
| Report (`/report/[id]`) | 8 | 7 | 7 | 8 | 7 | — | Code-level only |
| Founder OS Home | 8 | 8 | 7 | 7 | 8 | — | Live: MRR $299; metric tension |
| Founder OS Inbox | 9 | 9 | 8 | 9 | 9 | — | Manual approval confirmed |
| Founder OS Prospects | 8 | 8 | 7 | 8 | 8 | — | Agency filter empty (no data yet) |
| Founder OS Customers | 6 | 7 | 5 | 6 | 6 | — | Empty state contradicts Home |
| Founder OS Settings | 8 | 6 | 8 | 9 | 8 | — | Safety dials clear |
| Agency Section (`/#agencies`) | 7 | 7 | 8 | 8 | 6 | — | Anchor-only |
| `/agencies` / `/agency` | — | — | — | — | — | — | **404** |

---

## 10. Revenue Blockers

1. **No agency destination (P0).** Every agency email click lands on a generic, `plan=agency`-blind signup. The $299 motion leaks at the highest-intent moment. No `/agencies` landing page exists.
2. **No prospect-specific summary page (P1).** Cold prospects are asked to create an account before seeing a tailored, low-friction summary of *their* site's findings + value. This raises activation friction.
3. **Generic signup for warm traffic (P1).** Signup does not adapt to outreach/agency context (no plan pre-selection, no value reinforcement, no "your scan" continuity).
4. **Build/deploy fragility (P1, infra).** OOM in `next build` threatens reproducible deploys of revenue-bearing changes.
5. **Agency self-serve checkout exists but discovery of it is weak (P2).** Pricing has an Agency block + "Upgrade to Agency" button, but the public path to it (anchor link) is shallow.

---

## 11. Top 10 Fixes Before Beta (ranked)

| Rank | Fix | Priority | Why |
|---|---|---|---|
| 1 | Add a real agency destination — `/agencies` landing page **or** `plan=agency`-aware signup/pricing | **P0** | Stops leaking warm agency clicks; unblocks scaling the $299 motion |
| 2 | Contain/resolve `next build` OOM (type-check worker) | **P0** | Reproducible deploys for all revenue work |
| 3 | Make signup outreach-aware (continuity from scan, prospect token, agency context) | **P1** | Lifts activation on hard-won outreach clicks |
| 4 | Add prospect-specific summary page before signup | **P1** | Lower-friction conversion than direct account creation |
| 5 | Keep the no-auto-send invariant under CI (run `verify-product-qa-invariants.ts`) | **P1** | Prevents a future Autopilot change from silently enabling auto-send |
| 6 | Clarify "Autopilot" naming / in-product copy (human-in-loop) | **P2** | Avoids owner mis-expectation; reduces risky bulk-approve behavior |
| 7 | Fix Founder OS metric inconsistencies (Customers vs Home; email open rate) | **P1** | Restores founder trust in operating data |
| 8 | Mobile pass on Founder OS + customer `/app` dashboard | **P2** | Public pages pass; dashboards untested on mobile |
| 9 | Deep-linkable agency content (standalone page, not just `/#agencies`) | **P2** | Lets outreach/ads point at a real URL |
| 10 | Sync QA account password + complete simulated-plan customer QA | **P2** | Unblocks `/app` gating verification |
| 11 | Resolve Edge Runtime `process.version` warning path | **P3** | Hygiene; avoid future edge incompat |
| 12 | Add explicit agency plan pre-selection on Stripe checkout from agency links | **P2** | Removes a click between intent and purchase |

---

## 12. Top 10 Revenue Features (ranked, with impact/effort)

Each ranked **P0–P3**, with **revenue impact** (high/med/low) and **effort** (high/med/low).

| Rank | Feature | Priority | Revenue impact | Effort | Why it matters |
|---|---|---|---|---|---|
| 1 | **Agency landing page** (`/agencies`) | **P0** | High | Med | The entire $299 outreach motion currently dead-ends on a generic signup; this is the highest-ROI single page in the product |
| 2 | **Prospect-specific summary page** (instead of direct signup link) | **P0** | High | Med | Show the prospect *their* findings + value before asking for an account; biggest lever on outreach→trial conversion |
| 3 | **Better public scan summary** (richer, shareable `/scan-result`) | **P1** | High | Med | Improves the top-of-funnel that feeds every paid plan |
| 4 | **Better upgrade prompts** (in-app, contextual, plan-aware) | **P1** | High | Low | Cheap conversion lift on existing traffic; reuse funnel state already plumbed into Pricing |
| 5 | **"Fix this first" recommendation engine** | **P1** | High | High | Turns findings into action → demonstrates value → retention + upgrades |
| 6 | **Monthly client-ready PDF report** (agency-branded) | **P1** | High | Med | Directly justifies the $299 Agency tier; `pdfkit` already a dependency |
| 7 | **Agency white-label reports** | **P1** | Med | High | Strong differentiator + stickiness for the Agency segment |
| 8 | **"What changed since last scan"** (change digest) | **P2** | Med | Med | Recurring value that makes monitoring feel alive; supports retention emails |
| 9 | **Onboarding checklist** | **P2** | Med | Low | Activation lift; reduces early churn for new trials |
| 10 | **Better customer retention emails** | **P2** | Med | Low | `retentionOutreach` infra exists; expand templates/triggers (human-approved) |

**Additional evaluated items (ranked):**

| Feature | Priority | Revenue impact | Effort | Note |
|---|---|---|---|---|
| Better alert center | P2 | Med | Med | Consolidate SSL/domain/change alerts into one actionable hub |
| Dashboard simplification | P2 | Med | Med | Reduce density; lead with score + top action |
| Mobile dashboard redesign | P2 | Med | High `[BROWSER LANE]` | Verify need against live mobile findings first |

---

## 13. What Is Working Well

- **Access control & isolation** — textbook owner-gating with defense-in-depth at route, page, and middleware layers.
- **Human-in-the-loop outreach** — no auto-send; explicit approval surfaces; multiple send-safety guards (cooldown, daily limit, customer/internal exclusion, scan-complete requirement).
- **Agency system design** — clean separation from SMB, transparent scoring with human-readable rationale, conservative segmentation, and genuinely good (non-spammy, business-first) agency copy.
- **Reliability fixes intact** — follow-up dedupe at code + DB level; no cascade.
- **Copy honesty** — free tier is explicitly a one-time preview; no false "continuous monitoring" promise.
- **Deliverability discipline** — verified root sender; unverified subdomain intentionally disabled and reported as healthy; sandbox fallbacks guarded.
- **Metric integrity** — internal/QA/test accounts excluded from founder metrics via a single source of truth + DB flag.
- **Type safety** — `tsc --noEmit` passes clean across the whole project including the new script.

---

## 14. What Is Noise / Should NOT Be Built Yet

- **Mobile dashboard *redesign*** — confirm the actual problem with live `[BROWSER LANE]` findings before investing in a redesign; a responsive pass may suffice.
- **Expanding "Autopilot" toward auto-send** — do **not**. Keep the human-in-the-loop invariant; the value is in *assisted* approval, not unattended sending.
- **More owner dashboards / intelligence panels** — Founder OS is already feature-dense (CEO advisory, data moat, competitor intel, content studio, video ad creator). Adding more analytics surfaces has low marginal revenue value vs. fixing the agency conversion path.
- **New acquisition channels** — premature until the agency *destination* exists; sending more outreach without a landing page multiplies a known leak.
- **Custom email tracking domains** — currently a warning, not a blocker; the verified root sender works. Defer until volume justifies it.

---

## 15. Final Recommendation Before Sending More Outreach

**Proceed with a small, controlled, hand-reviewed beta batch now; do not scale until the agency destination exists.**

The code-level safety invariants required to send outreach responsibly are all green: owner-only isolation, no auto-send, manual approval, follow-up dedupe, agency/SMB separation, NOT-FIT containment, internal/QA metric exclusion, honest free-tier copy, and verified-sender deliverability. A tiny first batch (≤ 10–20 manually approved agency prospects) is structurally safe.

**Before increasing volume, do two things:**
1. **Build the agency destination** — a `/agencies` landing page or a `plan=agency`-aware signup/pricing experience — so the $299 CTA stops leaking warm clicks into a generic signup.
2. **Stabilize `next build`** (OOM in the type-check worker) so revenue changes deploy reproducibly.

Wire `scripts/verify-product-qa-invariants.ts` into CI so the no-auto-send and isolation guarantees can never silently regress as the agency motion scales.

---

### Appendix A — Verification Evidence

- `scripts/verify-product-qa-invariants.ts` — **60 passed · 0 failed · 1 manual-review** (dashboard mobile layouts still unverified).
- `scripts/verify-agency-prospect-system.ts` — **37 checks passed** (live DB scan skipped — no service creds).
- `scripts/verify-follow-up-scheduling.ts` — **all checks passed** (live scan skipped).
- `scripts/verify-outreach-copy-quality.ts` — **all checks passed** (live draft scan skipped).
- `npx tsc --noEmit` — **passed clean** (re-run Jun 19 2026).
- `npm run build` — **FAILED (environmental):** process exit `-1073741819` / OOM even with `NODE_OPTIONS=--max-old-space-size=8192`; compilation starts then host kills worker. Types valid per `tsc --noEmit`.

### Appendix C — Live browser sessions

- **Anonymous:** landing, pricing, signup, login, free scan E2E, owner gating (401/redirect), `/agencies`+`/agency` 404, break tests — all pass except known agency conversion gap.
- **Owner:** full Founder OS walkthrough; inbox manual-approval confirmed; no emails sent.
- **Agency customer:** enterprise portal OK; Founder OS blocked.
- **QA customer:** login rejected — customer `/app` pass incomplete.

### Appendix B — Audit Constraints Honored

No emails sent · no outreach approved or sent · no existing source files modified · no commits/pushes · no Stripe/Resend config changed · no real customer/prospect data created · work confined to branch `main`.
