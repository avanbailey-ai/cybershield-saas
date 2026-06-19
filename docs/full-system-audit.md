# CyberShield Cloud — Full System Audit (End-to-End)

**Date:** 2026-06-19  
**Branch audited:** `main` (post prospect-execution-fix, email-infrastructure)  
**Method:** Codebase trace, existing audit docs, static verification, production-logic review — **not** assumed pass from unit scripts alone.

---

## 1. Executive summary

CyberShield is a **real, multi-layer SaaS** with working auth, Stripe billing, scan queue, customer dashboard, monitoring crons, and a substantial Founder OS execution layer. It is **not** a demo shell.

However, **several systems only look complete in the UI or in verification scripts** while failing or degrading in production paths that matter for beta:

| Risk area | Verdict |
|-----------|---------|
| **Prospect → customer outreach** | **PARTIAL** — send path exists; contact discovery & pipeline gating were recently broken/misleading; email deliverability still depends on Resend/DNS |
| **Customer retention emails** | **PARTIAL** — monitoring alerts heavily **plan-gated**; paid customers may still see gaps |
| **Founder metrics (MRR/health)** | **PARTIAL** — filters owner/test emails but **not `is_qa_account`** profiles |
| **Email infrastructure** | **PARTIAL** — DMARC/SPF/CNAME added; **mail-subdomain DKIM** may still block verified sends |
| **Feature completeness** | **MIXED** — core scan/report/health strong; malware, white-label, competitor benchmark **placeholders** |

**Do not assume beta-ready outreach or retention email until production smoke tests pass.**

---

## 2. Pass / fail by system

| # | System | Status | Notes |
|---|--------|--------|-------|
| 1 | Public website | **PASS** | Landing, features, SEO pages, scan CTA |
| 2 | Signup / login / auth | **PARTIAL** | Email signup + attribution wired; **Google OAuth skips prospect attribution** |
| 3 | Pricing / billing / Stripe | **PASS** | Checkout, webhooks, portal (Layer 0) |
| 4 | Customer dashboard | **PASS** | Websites, scans, reports wired |
| 5 | Website management | **PASS** | CRUD, priority monitoring slots |
| 6 | Scanning | **PASS** | Queue + worker crons (Layer 0) |
| 7 | Reports | **PASS** | Report pages + PDF paths |
| 8 | Health Center | **PASS** | Per-website health aggregation |
| 9 | Change Timeline / Memory | **PASS** | Diff detection + timeline UI |
| 10 | Alerts | **PARTIAL** | Events logged; **many emails skipped (plan_gated)** |
| 11 | SSL monitoring | **PASS** | Cron + post-scan handler |
| 12 | Domain monitoring | **PASS** | Weekly cron + expiry alerts |
| 13 | Email infrastructure | **PARTIAL** | Code complete; DNS/Resend verification ongoing |
| 14 | Resend delivery | **PARTIAL** | Outreach/retention send; alerts gated; env-dependent |
| 15 | Outreach execution | **PARTIAL** | Approve & Send real; needs email + verified sender |
| 16 | Follow-up scheduling | **PASS** | `followUpScheduler.ts` + cron discovery |
| 17 | Prospect discovery | **PARTIAL** | OSM/Nominatim real; **low qualify rate** (contact email) |
| 18 | Prospect qualification | **PARTIAL** | Scoring real; pipeline UX was misleading (fix in flight) |
| 19 | Founder OS | **PARTIAL** | Home/Inbox/Success strong; Prospects historically painful |
| 20 | Founder Inbox | **PASS** | Approvals execute automation (`inboxAutomation.ts`) |
| 21 | Customer Success | **PASS** | Health, expansion, revenue-at-risk engines |
| 22 | Revenue metrics | **PARTIAL** | **Dual MRR calculators disagree**; QA/`is_qa_account` gaps |
| 23 | Archive / delete hygiene | **PASS** | Soft delete, auto-archive, ignore_forever |
| 24 | Cron jobs | **PARTIAL** | 8 scheduled routes exist; **`admin-digest` likely 405 on Vercel GET** |
| 25 | Vercel env | **UNKNOWN** | Encrypted vars not readable locally; must verify dashboard |
| 26 | Supabase / RLS | **PARTIAL** | 55 migrations; remote parity must be confirmed |
| 27 | SEO / domain / email readiness | **PARTIAL** | SEO docs exist; email DNS partially applied |

---

## 3. Top 25 issues (ranked by severity)

| Rank | Severity | Issue | Impact |
|------|----------|-------|--------|
| 0 | **CRITICAL** | **`/api/cron/admin-digest` POST-only** — Vercel Cron uses GET → daily admin digest likely **never runs** | Owner ops blind to daily rollup |
| 1 | **CRITICAL** | **Dual MRR sources** (`metrics.ts` vs `businessHealthMetrics.ts`) — Home vs API payload can disagree; trialing included in one path only | Wrong operator decisions |
| 2 | **CRITICAL** | Monitoring alert emails **plan_gated** for non-paying tiers | Free users: dashboard-only alerts; paid path must be verified separately |
| 3 | **CRITICAL** | **Mail-subdomain DKIM** may be missing (`resend._domainkey.mail`) | Approve & Send fails or lands in spam |
| 4 | **CRITICAL** | **`CRON_SECRET` unset → all crons 401** | No scheduled scans, digests, discovery, SSL/domain sweeps |
| 5 | **CRITICAL** | Prospect **contact email** often missing (phone-only sites) | Send queue dead ends; discovery shows 0 outreach-ready |
| 6 | **HIGH** | **Google OAuth signup skips attribution** | Breaks prospect→customer tracking for OAuth users |
| 7 | **HIGH** | **`is_qa_account` + churn paths not filtered** in founder metrics | Inflated MRR/churn/activity |
| 8 | **HIGH** | **Signup inbox approve** emails recent signups batch, not targeted user | Wrong onboarding blast risk |
| 9 | **HIGH** | **Free-tier “continuous monitoring” marketing** vs manual-only scans | Misleading before checkout |
| 10 | **HIGH** | **`RESEND_WEBHOOK_SECRET` optional** — webhook accepts unauthenticated POSTs if unset | Spoofed engagement events |
| 11 | **HIGH** | **AI Chief of Staff computed but not mounted** in UI | FLOW 4 surface missing despite data in payload |
| 12 | **HIGH** | Attribution token in **sessionStorage only** | Lost on device/browser change |
| 13 | **HIGH** | **Interested-lead approve** = CRM tasks only, no email | Manual close loop |
| 14 | **HIGH** | **Org invite email placeholder** | Team invites don't send |
| 15 | **HIGH** | **`daysToGoal` dead** (daily pace always 0) | Misleading Home goal UX |
| 16 | **MEDIUM** | Alert/digest templates lack unified compliance footer | Deliverability/trust gap vs outreach |
| 17 | **MEDIUM** | **HOT/WARM counts inconsistent** across page SSR vs pipeline | Confusing prospect metrics |
| 18 | **MEDIUM** | **Customer Success view read-only** — looks actionable, isn't | Operator friction |
| 19 | **MEDIUM** | **Duplicate inbox rows** (risk + churn for same customer) | Double retention prompts |
| 20 | **MEDIUM** | **Industry benchmarking** mock data | Misleading if shown as live |
| 21 | **MEDIUM** | **Owner page SSR loads unused props** | Wasted fetch + stale parallel metrics |
| 22 | **MEDIUM** | **prospect-discovery cron** no top-level try/catch | One failure aborts entire nightly run |
| 23 | **MEDIUM** | **Campaign tasks queued with no UI** (`owner_campaign_tasks`) | Invisible automation debt |
| 24 | **LOW** | **Duplicate migration timestamps** (3 pairs) | Fresh `db push` ordering risk |
| 25 | **LOW** | Settings profile edit **“coming soon”** | Trust polish |

---

## 4. Broken workflows

### 4.1 Prospect → customer (before recent fixes; verify after deploy)

```
Discovery → insert → scan → qualification → outreach_ready → draft → Approve & Send → Resend
```

**Failure points observed in code + operator reports:**

1. **Contact discovery** finds phone but not email → pipeline stuck in `needs_contact` while UI showed "Contact available"
2. **Drafts created** but send blocked when `contact_email` null (even if `recipient_email` on draft)
3. **Outreach Ready tab empty** while Send queue shows blocked drafts
4. **Discovery outcome counters** count only same-run batch → historical runs all show `0 qualified`

**Recent mitigations (verify live):** `reconcilePipeline`, honest contact labels, `effectiveOutreachEmail`, multi-path contact fetch.

### 4.2 Customer retention email

```
Scan/monitoring event → alert pipeline → sendAlertEmail → Resend
```

**Failure point:** `sendAlertEmail.ts` + `emailPipeline.ts` return **`plan_gated`** for accounts without monitoring email feature. Dashboard shows alerts; **inbox stays quiet** for many users.

### 4.3 Signup attribution

```
Outreach link → /api/email/click → signup with token → /api/attribution/signup
```

**Failure point:** Token stored in `sessionStorage` (`SignupForm.tsx`). Direct signup, new tab, or cleared storage → **no attribution**.

### 4.4 Team invite

```
Dashboard → invite member → API creates invite → (email placeholder)
```

**Failure point:** Response says `"email delivery placeholder"` — invite not delivered.

---

## 5. Dead buttons / non-executing actions

| Location | Control | Actual behavior |
|----------|---------|-----------------|
| `app/dashboard/settings/page.tsx` | Profile name/photo | **"coming soon"** — no save |
| `app/enterprise/demo/EnterpriseDemoForm.tsx` | Calendly | **Placeholder text** only |
| `app/api/org/members/route.ts` | Invite member | Creates row; **no email** |
| Founder OS **Customers** | Some advisory tiles | Navigate-only duplicates of Success |
| `components/owner/LeadCrm.tsx` | CRM views | Secondary tool; not on main Founder nav shell |
| Prospects **Generate outreach** (no email) | Was disabled/dead click | Fixed → **Find email on website** |

**Not dead (verified wired):** Run discovery, Approve & Send, inbox approve, retention/upgrade send, scan, archive, contact discovery, reconcile pipeline.

---

## 6. Fake / incomplete features

| Feature | Status | Evidence |
|---------|--------|----------|
| Malware/blacklist monitoring | **Not built** | `scripts/verify-feature-audit.ts` placeholder, empty paths |
| White-label reports | **Placeholder** | Enterprise PDF only |
| Competitor benchmarking | **Placeholder** | Category percentiles only |
| Uptime monitoring | **Partial** | Scan-derived HTTP status |
| Industry benchmarking | **Partial/mock** | `lib/analytics/benchmarking.ts` |
| AI remediation "assistant" | **Partial** | Deterministic templates, not LLM |
| Org email invites | **Placeholder** | API message |
| Autopilot campaign tasks | **Partial** | Inserts tasks; weak completion loop |
| Plugin/CVE intelligence | **Partial** | CMS hints only |

---

## 7. Data accuracy problems

### MRR / ARR / customers

**Source:** `lib/owner/businessHealthMetrics.ts`

- Sums **display plan amounts** for profiles with `subscription_status` active/trialing and plan in `pro`, `growth`, `agency`
- **Excludes** emails matching `isInternalCustomerEmail()` (owner, `+test`, disposable domains)
- **Does NOT exclude** `profiles.is_qa_account = true` unless email matches heuristics
- **Revenue at risk:** `lib/owner/revenueAtRisk.ts` — health + past_due subscriptions, same email filter

### Prospect counts / HOT-WARM-LOW

**Source:** `lib/owner/leadScore.ts` (from scan score/risk/issues), pipeline in `lib/owner/pipeline.ts`

- Opportunity score computed in `lib/owner/salesIntelligence.ts` (may differ from DB if not reconciled)
- Discovery run stats only reflect **prospects inserted in that run** after scan

### Activity feed

**Source:** `lib/owner/activityFeed.ts` — real DB events; filters internal emails on signup events

---

## 8. Email / deliverability problems

See also `docs/email-infrastructure-audit.md`.

| Item | Expected | Risk |
|------|----------|------|
| `RESEND_API_KEY` | Vercel production | Empty locally; must confirm dashboard value |
| `EMAIL_FROM` | Verified sender | Was migrated root vs mail subdomain |
| DMARC | `_dmarc` TXT p=none | Added via Vercel DNS |
| SPF/MX | `mail.` subdomain | Added |
| DKIM | `resend._domainkey.mail` | **May still be NXDOMAIN** — blocks verified send |
| Webhook | `/api/resend/webhook` + secret | Route enforces Bearer auth |
| Open/click tracking | `/api/email/open`, `/api/email/click` | Requires `EMAIL_TRACKING_SECRET`; custom domains optional |
| Plain text + footer | `buildEmailDocument()` | Outreach/retention yes; **alerts/funnel not unified** |
| Bounce/complaint | Webhook → `owner_email_engagement_events` | Depends on Resend webhook config |

**Production smoke test required:** Owner → Approve & Send to non-owner address → confirm delivery + engagement log.

---

## 9. Database / migration risks

- **55 migration files** under `supabase/migrations/` — confirm **remote applied list matches** (CLI/MCP)
- Critical recent: `20260620000000_prospect_attribution.sql`, `20260620100000_email_infrastructure.sql`, `20260619010000_founder_outreach_execution.sql`
- **Duplicate timestamp prefix** `20260615120000` (two files) — ordering ambiguity
- **RLS:** Scan queue, profiles, org members hardened in mid-202606 migrations; owner routes use **service role** via `createAdminClient()` — correct for Founder OS but **must stay owner-gated at API**
- **Soft delete:** `deleted_at` on prospects, drafts; archive states separate
- **QA flag:** `profiles.is_qa_account`, `qa_simulated_plan` — used in `planService.ts`, not founder filters

---

## 10. Production env risks

| Variable | Required for | Risk if missing/wrong |
|----------|--------------|------------------------|
| `RESEND_API_KEY` | All email | Silent skip in `lib/email.ts` |
| `EMAIL_FROM` | Sender identity | Sandbox fallback in dev only |
| `RESEND_WEBHOOK_SECRET` | Engagement events | Webhook 401 or insecure |
| `EMAIL_TRACKING_SECRET` | Signed tracking URLs | Weak/default secret |
| `CRON_SECRET` | All crons | 401 on workers |
| `STRIPE_*` | Billing | Checkout/webhook failure |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin/owner/cron | Backend failure |
| `OPENAI_API_KEY` | Optional AI narratives | Graceful degrade |

Vercel **encrypts** env vars — local `vercel env pull` shows empty values; **never treat pull as proof**.

---

## 11. UX trust issues

| Issue | Where |
|-------|-------|
| "Contact available" when only phone exists | Prospect cards (fixed in recent branch) |
| Send queue promises "ready" with blocked drafts | Prospects page (fixed) |
| Repeated discovery outcome rows with zeros | LeadDiscovery (collapsed to details) |
| Internal pipeline states visible | Some admin views |
| Raw scanner issue strings | Report/alert copy (partially enriched) |
| Duplicate MRR/customer tiles | Home vs CEO vs Customers (partially deduped in V6) |
| Settings "coming soon" | Dashboard settings |
| `example.com` in marketing previews | Hero, HealthCenterPreview |

---

## 12. Flow audits (detailed)

### Flow 1 — Visitor to customer

| Step | Implementation | Production risk |
|------|------------------|-----------------|
| Landing | `app/page.tsx`, `components/landing/*` | Low |
| Free scan | `app/api/scan/public/route.ts`, `ScanInput` | Rate limits / queue load |
| Signup | `app/signup`, `SignupForm`, Supabase | Low |
| Plan / checkout | Stripe checkout actions, `app/api/stripe/*` | Webhook must be live |
| Dashboard access | `middleware.ts`, auth | Layer 0 |
| Add website | `app/api/websites/route.ts` | Low |
| First scan | Queue cron `*/5 * * * *` | Queue backlog under load |
| Report | `app/report/[id]` | Low |
| Health Center | `fetchWebsiteHealthCenter.ts` | Low |
| Monitoring on | Continuous monitoring migration + crons | Alert **email** may not fire (plan gate) |

### Flow 2 — Customer retention

| Step | Status | Notes |
|------|--------|-------|
| Monitoring checks | PASS | Scan diff + SSL + domain crons |
| Email alerts | **PARTIAL** | plan_gated skips |
| Digests | PASS | Weekly/monthly crons if plan allows |
| Customer health | PASS | Founder Success view |
| Revenue at risk | PASS | Real subscription + health signals |
| **Would customer keep paying?** | **MAYBE** | Dashboard value yes; **email value inconsistent** on lower tiers |

### Flow 3 — Prospect to customer

| Step | Files | Status |
|------|-------|--------|
| Discovery | `lib/owner/discovery/engine.ts`, cron + manual | PASS insert; qualify weak |
| Scan | `prospectScanUpdate.ts`, `/api/owner/prospects/[id]/scan` | PASS |
| Qualification | `pipeline.ts`, `salesIntelligence.ts` | PARTIAL |
| Contact | `contactDiscovery.ts`, `/contact` route | PARTIAL |
| Draft | `ensureOutreachDraft.ts` | PASS |
| Approve & Send | `outreachExecution.ts`, `/send` route | PASS if email + Resend |
| Logging | `owner_email_deliveries`, events | PASS |
| Tracking | click/open routes, webhook | PARTIAL (env/DNS) |
| Signup attribution | `SignupForm`, `/api/attribution/signup` | PARTIAL |
| Interested → CRM | `interestedLeadApproval.ts` | PARTIAL |
| Paid conversion | `reconcilePaidConversions` in cron | PASS code path |
| Follow-ups | `followUpScheduler.ts` | PASS |

### Flow 4 — Founder OS

| Page | Data source | Execution |
|------|-------------|-----------|
| Home | `founderOsV6.ts` | Real; 6 sections |
| Inbox | `buildInbox`, `inboxAutomation.ts` | Approvals execute |
| Prospects | discovery + pipeline + queue | **Historically weakest** |
| Customers | `getCustomerDirectory` | Actions via inbox |
| Success | health/expansion/risk engines | Strong |
| Settings | `owner_founder_settings` | MRR goal save works |
| Email intelligence/health | `emailIntelligence.ts`, `dnsHealth.ts` | DB + DNS checks |
| Automation health | `automationHealth.ts` | Env + cron checks |

### Flow 5 — Admin data accuracy

- **MRR:** active/trialing × plan display price, excludes internal **emails** only
- **Trials:** `subscription_status === 'trialing'`
- **Conversion:** new signups vs upgrades in 30d window (`businessHealthMetrics.ts`)
- **Churn risk:** `churn_risk_score` on profiles + health engine
- **Prospect tiers:** `lead_score` HOT/WARM/LOW from scan
- **Gap:** QA simulated plans may appear as real customers

### Flow 6 — Email (summary)

Covered in §8. Approve & Send uses `buildEmailDocument` + `sendEmail` + attribution wrapper.

### Flow 7 — Database (summary)

Covered in §9. Owner APIs must never expose service role to non-owner clients.

### Flow 8 — Cron jobs

| Schedule | Path | Purpose | Auth |
|----------|------|---------|------|
| `*/5 * * * *` | `/api/scan/enqueue-or-process-batch` | Scan queue | CRON_SECRET |
| `0 */6 * * *` | `/api/workers/process-emails` | Email queue + abandoned checkout | CRON_SECRET |
| `0 14 * * 1` | `/api/cron/weekly-digest` | Weekly digest | CRON_SECRET |
| `0 10 1 * *` | `/api/cron/monthly-report` | Monthly report | CRON_SECRET |
| `0 8 * * *` | `/api/cron/admin-digest` | Admin digest | CRON_SECRET |
| `0 6 * * *` | `/api/cron/ssl-expiry-check` | SSL expiry | CRON_SECRET |
| `0 7 * * 1` | `/api/cron/domain-monitor` | Domain expiry | CRON_SECRET |
| `0 3 * * *` | `/api/cron/prospect-discovery` | Nightly discovery + hygiene | CRON_SECRET |

**Not in cron:** `/api/cron/setup-mail-domain` (manual/owner trigger only).

**Last-run visibility:** No centralized cron run log table — check Vercel cron logs + application logs.

### Flow 9 — UI trust (summary)

Covered in §11.

---

## 13. Recommended fix order (proposal only — do not implement in audit pass)

### Phase 1 — Critical blockers (before beta outreach)

1. Confirm **Resend domain + DKIM** verified; smoke-test Approve & Send
2. Fix **monitoring alert plan gating** policy for paying customers (or set expectations)
3. Run **prospect reconcile** in production; verify Send queue end-to-end
4. Exclude **`is_qa_account`** from all founder revenue/health metrics
5. Confirm **Supabase migrations** applied remotely

### Phase 2 — Revenue workflow fixes

6. Harden **signup attribution** (cookie + URL param fallback)
7. Complete **interested → CRM → customer** automation
8. Unify **alert/digest templates** with compliance footer
9. Discovery **qualified/outreach-ready** metrics across full pipeline not just run batch

### Phase 3 — Retention / customer fixes

10. Clarify **uptime vs scan frequency** in UI
11. Implement **org invite emails**
12. Review **plan_gated** matrix vs marketing promises

### Phase 4 — UX trust polish

13. Remove/consolidate **CEO dashboard vs Founder OS** duplication
14. Settings profile editing or hide until ready
15. Replace **mock benchmarking** labels with "estimated" or hide

### Phase 5 — Growth enhancements

16. Malware/blacklist (if promised)
17. White-label PDF branding
18. Dedicated uptime probes
19. Autopilot task completion UX

---

## 14. What works (confirmed in code)

- Supabase auth + middleware-protected dashboard
- Stripe checkout + webhook subscription sync
- Scan queue processing (frozen core) + scheduled scans
- Website CRUD, Health Center, Change Timeline
- SSL + domain expiry monitoring crons
- Founder Inbox approval → real sends (outreach, retention, upgrade, onboarding batch)
- Customer Success health / expansion / revenue-at-risk engines
- Outreach execution with cooldown, daily limits, approval gate, delivery logging
- Prospect discovery from OpenStreetMap/Nominatim (real businesses, validation)
- Archive/hygiene/auto-archive crons
- Email click/open tracking routes + Resend webhook handler (when configured)

---

## 15. What does not work or only looks like it works

- **Monitoring emails** for many accounts (plan_gated)
- **Prospect outreach** when contact email missing (common)
- **Verified sender** if DKIM incomplete
- **Team invites** (placeholder)
- **Several enterprise/marketing features** (placeholders per feature audit)
- **Verification scripts alone** as production proof

---

## 16. Dangerous to show beta users

- Prospects page **before reconcile/deploy** (misleading contact + empty outreach-ready)
- **Industry/competitor benchmarks** if labeled as live data
- **"Monitoring alerts to your inbox"** without plan clarification
- **Team invite** flow
- Any **MRR/revenue** screenshot that includes QA accounts

---

## 17. Verification

```bash
npx tsx scripts/verify-full-system-audit.ts
npx tsc --noEmit
npm run build
```

Static script checks routes, crons, owner auth, migrations on disk, and known placeholders. **Does not replace production smoke tests.**

---

## 18. Related audit documents

- `docs/owner-dashboard-execution-audit.md` — Founder OS button wiring
- `docs/founder-os-v6-audit.md` — V6 usefulness scores
- `docs/email-infrastructure-audit.md` — DNS/deliverability
- `scripts/verify-feature-audit.ts` — 25-feature placeholder registry

---

*Audit pass complete. No code fixes applied in this document. Subagent reviews (Flows 1–8) merged 2026-06-19. Proceed with Phase 1 after stakeholder review.*

---

## 19. Subagent corroboration (2026-06-19)

Parallel read-only reviews confirmed and extended this audit:

| Review | Scope | Net-new critical items |
|--------|-------|------------------------|
| [Flows 1–3](b71fed75-6c53-4424-8e2d-6ab678e32eba) | Visitor→customer, retention, prospect pipeline | OAuth attribution gap; free-tier monitoring mismatch; signup approve blast |
| [Founder OS & metrics](fcd7fc08-bdb9-4ab3-8266-2abfc128551c) | Home/Inbox/Prospects/Customers/Success | Dual MRR; AI Chief not mounted; HOT/WARM drift; invisible campaign tasks |
| [Infra, cron, DB, email](a3081212-f0af-4d5c-8ca5-2f6fc754d2bc) | Email/DNS, RLS, crons, SEO | `admin-digest` GET missing; webhook auth optional; env not validated at startup |

**Unified Phase 1 recommendation:** fix `admin-digest` GET, unify MRR source, confirm `CRON_SECRET` + Resend DNS, then smoke-test Approve & Send and one paid monitoring email path before beta outreach.
