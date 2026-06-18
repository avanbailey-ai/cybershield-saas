# Owner Dashboard Execution Audit

**Branch:** `checkpoint/owner-dashboard-rebuild`  
**Audited:** 2026-06-18  
**Scope:** Founder OS pages, lib/owner execution layer, app/api/owner routes

## Executive summary

The pre-rebuild dashboard mixed real execution (outreach send, inbox approve, discovery) with duplicate metrics, read-only success views, and partial inbox actions. Home showed 7+ overlapping sections (banner, inbox preview, AI chief, revenue movement, activity log, best opportunity, customer risks) that duplicated Inbox and Success pages.

**Top issues fixed in this rebuild:**
- Home reduced to exactly 6 operator sections
- MRR/conversion now explainable via `businessHealthMetrics.ts` + View calculation modal
- Test accounts excluded from metrics via `founderCustomerFilters.ts`
- Signup inbox approval now sends onboarding email (was task-only)
- Pending approval count includes all approvable inbox types
- Customers page gains retention/upgrade/mark status actions
- Automation health + AI audit export added

---

## Navigation shell

| Component | Purpose | Data | Buttons |
|-----------|---------|------|---------|
| `FounderShell.tsx` | Sidebar nav | `founderData.inbox.length` (real) | Section nav → client hash routing; Refresh link → full page reload |
| `FounderNavContext.tsx` | State + refresh | `/api/owner/founder-os` (real) | `refreshFounderData()` refetches V6 payload |
| `FounderOs.tsx` | Route views | Server props + context | N/A |

**Dead/fake:** None. "Autopilot active" indicator is inbox-count-based (real).

---

## Home (`FounderHomeView.tsx`) — REBUILT

### Before
| Section | Data | Issues |
|---------|------|--------|
| ExecutionCommandBanner | `executionStats` (real) | Duplicated inbox; Approve All only sent outreach IDs |
| Action queue | inbox slice (real) | Duplicate of Inbox page |
| AiChiefOfStaff | Generated bullets (real DB) | Vanity duplicate of activity + inbox |
| Revenue movement | MRR, at-risk (real) | Duplicated Business Health |
| Execution log | activityFeed (real) | OK but buried among clutter |
| Best opportunity | biggestOpportunity (real) | Overlapped Prospects + Revenue opportunities |
| Customer risks | inbox filter (real) | Duplicated Success page |

### After (6 sections only)
1. **Business Health** — `v6.businessHealth` from `getBusinessHealthMetrics()` (filtered real subscriptions)
2. **What Happened While You Were Away** — `v6.activityFeed` (real events, 24h)
3. **Founder Inbox** — top 5 inbox items; approve/dismiss → `/api/owner/inbox`
4. **Next Revenue Opportunities** — `v6.revenueOpportunities`; execute → inbox approve or navigate
5. **Customer Risk & Expansion** — health + expansion + retention/upgrade approve
6. **Automation Health** — `v6.automationHealth` from env + DB checks

**Export AI Audit** → `GET /api/owner/founder-os-audit` downloads JSON.

---

## Inbox (`FounderInboxView.tsx`)

**Purpose:** Full approval queue for outreach, follow-ups, retention, expansion, signups, failed sends.

**Data:** `founderData.inbox` built in `founderOsV6.buildInbox()` from drafts, follow-ups, health, expansion, failed drafts, signups (all real DB).

| Button | Handler | Executes? |
|--------|---------|-----------|
| Filter chips | Client filter | Real (UI only) |
| Approve (per item) | `POST /api/owner/inbox` `{ action: 'approve' }` | **Yes** — see inboxAutomation |
| Dismiss | `POST /api/owner/inbox` `{ action: 'dismiss' }` | **Yes** — writes dismissals |
| Review | `setSection(item.module)` | Navigation only |

**Inbox approval execution (`inboxAutomation.ts`):**
| ID prefix | Action |
|-----------|--------|
| `draft-*` / `failed-*` | `sendApprovedOutreach` → Resend |
| `followup-*` | Generate + send follow-up |
| `risk-*` / `churn-*` | `sendRetentionEmail` or schedule retention |
| `exp-*` | Upgrade email via Resend |
| `signup-*` | **Fixed:** onboarding emails to recent signups |
| `interested-*` | Queues autopilot task (partial — navigates to prospects) |

**Removed from home:** Duplicate action queue.

---

## Prospects (`ProspectsView.tsx` → `LeadDiscovery.tsx`)

**Purpose:** Discovery, pipeline, send queue.

**Data:** `/api/owner/prospects`, `/api/owner/discovery`, `/api/owner/outreach/drafts` (real).

| Button | API | Executes? |
|--------|-----|-----------|
| Run discovery | `POST /api/owner/discovery/run` | **Yes** |
| Save search settings | `PUT /api/owner/settings` | **Yes** |
| Import URLs | `POST /api/owner/discovery` | **Yes** |
| Approve & Send | `POST /api/owner/outreach/[id]/send` | **Yes** (requires contact + completed scan) |
| Find contact | `POST /api/owner/prospects/[id]/contact` | **Yes** |
| Archive / Ignore | `PATCH /api/owner/prospects/[id]` | **Yes** |
| Run scan | `POST /api/owner/prospects/[id]/scan` | **Yes** |
| Regenerate draft | `POST /api/owner/outreach/[id]/regenerate` | **Yes** |

**NO CONTACT, NO SEND:** `OutreachApprovalCard` disables Approve & Send when `!hasOutreachContact(prospect)`. `ProspectsActionQueue` shows contact discovery CTA instead.

---

## Customers (`CustomersView.tsx`) — REBUILT

**Purpose:** Revenue protection directory.

**Data:** `GET /api/owner/customers` → `getCustomerDirectory()` (real health, scans, alerts, expansion).

| Button | Handler | Executes? |
|--------|---------|-----------|
| Send retention | Inbox approve `churn-{userId}` | **Yes** — Resend |
| Send upgrade email | Inbox approve `exp-{userId}` | **Yes** |
| Mark healthy / at risk | `PATCH /api/owner/customers/[userId]` | **Yes** — updates churn_risk_score |
| Open success center | Navigation | Real |

---

## Customer Success (`CustomerSuccessView.tsx`)

**Purpose:** Read-only health, revenue at risk, expansion lists.

**Data:** `founderData.v6.*` (real).

| Button | Handler | Issue |
|--------|---------|-------|
| Refresh | `refreshFounderData()` | Real |
| (none on rows) | — | **Gap:** no inline approve actions (use Home section 5 or Inbox) |

**Recommendation:** Keep as detail view; execution on Home + Inbox + Customers.

---

## Settings (`SettingsView.tsx`)

**Purpose:** Outreach automation + auto-archive settings.

| Button | API | Executes? |
|--------|-----|-----------|
| Save settings | `PUT /api/owner/settings` | **Yes** |
| Account link | `/dashboard/settings` | Navigation |

---

## Lib layer audit

| Module | Real data? | Notes |
|--------|------------|-------|
| `founderOsV5.ts` | Yes | Legacy aggregator; inbox superseded by V6 |
| `founderOsV6.ts` | Yes | Primary payload; now includes businessHealth, automationHealth, revenueOpportunities |
| `businessHealthMetrics.ts` | **New** | Filtered MRR/conversion with calculation metadata |
| `customerHealth.ts` | Yes | Excludes internal emails |
| `revenueAtRisk.ts` | Yes | From health records |
| `activityFeed.ts` | Yes | 24h events; filters signups |
| `outreachExecution.ts` | Yes | Resend send, cooldown, approval gate |
| `followUpScheduler.ts` | Yes | 3/7/14 schedule |
| `staleDataHygiene.ts` | Yes | Runs on discovery cron |
| `founderCustomerFilters.ts` | Yes | Test account exclusion |
| `automationHealth.ts` | **New** | Env + DB health checks |
| `founderOsAudit.ts` | **New** | AI audit JSON export |

---

## Misleading / duplicate metrics (pre-rebuild)

| Metric | Problem | Fix |
|--------|---------|-----|
| MRR on home vs V5 businessStatus | V5 used unfiltered `getBusinessOverview` | Home uses `businessHealthMetrics` with filters |
| Paying customers count | Included test accounts | Filtered in V5 + businessHealth |
| pendingApprovals | Counted outreach only | Counts all approvable inbox types |
| whileAway numeric summaries | Generic counts vs event feed | Home section 2 uses event feed only |
| V5 inbox + V6 inbox | Double-built | V6 replaces inbox entirely |

---

## Dead / fake buttons removed or fixed

| Location | Issue | Resolution |
|----------|-------|--------------|
| Home Approve All | Only outreach IDs | Removed from home; per-item approve in inbox section |
| Home "Review" on opportunity | Nav only | Moved to Revenue Opportunities with execute |
| Signup inbox approve | Task queue only | Sends onboarding email |
| Customer Success rows | No actions | Actions on Home + Customers |
| AiChiefOfStaff on home | Decorative duplicate | Removed from home |

---

## API routes (`app/api/owner/`)

| Route | Status |
|-------|--------|
| `founder-os` | Active — V6 payload |
| `founder-os-audit` | **New** — AI audit export |
| `automation-health` | **New** — health checks |
| `inbox` | Active — approve/dismiss |
| `outreach/[id]/send` | Active — Resend |
| `customers` | Active — directory |
| `customers/[userId]` | **New** — mark healthy/at risk |
| `discovery/run` | Active |
| `prospects/[id]/contact` | Active |

---

## Stale data rules (`staleDataHygiene.ts`)

| Rule | Implementation |
|------|----------------|
| Inbox dismissals | 30d cleanup |
| Discovery runs | Keep last 5 |
| Draft expiry | 14d flag |
| No-contact prospects | Archive after 30d |
| Failed sends | Stay visible until resolved |
| Follow-ups | Only when status `due` |

**Note:** Spec says collapse discovery after 7 days — current code keeps 5 runs regardless of age. Consider aligning in follow-up.

---

## What should be removed (legacy, not in nav)

These components exist but are **not mounted** in `FounderOs.tsx`:

- `OverviewView`, `CrmView`, `OutreachView`, `InsightsView`
- `FounderCommandCenter`, `DailyBriefing`, `OpportunityCenter`
- Marketing widgets: `CampaignPlanner`, `VideoAdCreator`, `SocialContentStudio`, etc.

**Action:** Leave unused; do not wire back without execution audit.

---

## Execution flow verification status

| Flow | Status |
|------|--------|
| Prospect outreach (discovery → send → contacted → follow-ups) | **Executes** via discovery engine + send API |
| Follow-up due → inbox → approve → send | **Executes** |
| New signup onboarding | **Fixed** — approve sends onboarding |
| Customer retention approve | **Executes** via retentionOutreach |
| Customer expansion approve | **Executes** via upgrade template |
| Mark healthy/at risk | **New** — PATCH customers API |

---

## Post-rebuild success criteria

- [x] Home has exactly 6 sections
- [x] MRR/conversion explainable
- [x] Test accounts excluded
- [x] AI audit export
- [x] Automation health panel
- [x] Verification script
- [x] Customers page actions
- [ ] Customer Success inline actions (deferred — use Inbox/Customers)
- [ ] Interested-lead approve (still task queue — navigate to Prospects)
