# Founder OS Action Audit

Last updated: growth autopilot sprint (`checkpoint/growth-autopilot-sprint`)

## Scope

Active Founder OS shell at `/dashboard/admin/owner` — 6 sections: **Home, Inbox, Prospects, Success, Customers, Settings**.

Orphan views (Overview, Outreach, CRM, Insights) exist in repo but are **not mounted** in navigation.

---

## Home (`Growth command center`)

| Label | Expected | API / behavior | Status |
|-------|----------|----------------|--------|
| Refresh | Reload V6 data | `GET /api/owner/founder-os` | **Real** |
| While you slept stats | Overnight cron metrics | `lib/owner/growthAutopilot` snapshot | **Real** |
| Today's money moves → | Navigate to inbox/prospects | `setSection()` | **Real** |
| Open inbox | Navigate to inbox | `setSection('inbox')` | **Real** |
| Why this lead? | Expand lead explanation | `explainLeadChoice()` | **Real** |
| Email health (expand) | Read-only DNS/delivery | `v6.emailHealth` | **Real** |

**Removed misleading copy:** sidebar no longer shows "Autopilot active" when inbox has items — now shows "N need approval".

---

## Inbox

| Label | Expected | API | Status |
|-------|----------|-----|--------|
| Approve & Send | Send via Resend after gates | `POST /api/owner/inbox` → `sendApprovedOutreach` | **Real** — deliverability + copy guard |
| Dismiss | Hide item | `POST /api/owner/inbox` → `owner_inbox_dismissals` | **Real** |
| Review | Navigate to relevant section | Maps `outreach` → `prospects` | **Fixed** |
| Filter chips | Filter queue types | Client-side | **Real** |

**Queue types:** Ready to send, Follow-up due, Interested, Customer risk, Upgrade, New signups.

**Loading/success/error:** busy state + inline error/success banners added.

---

## Prospects

| Label | Expected | API | Status |
|-------|----------|-----|--------|
| Run discovery | Find prospects | `POST /api/owner/discovery/run` | **Real** |
| Save discovery settings | Persist config | `PUT /api/owner/settings` | **Real** |
| Approve & Send (queue) | Send draft | `POST /api/owner/outreach/[id]/send` | **Real** |
| Scan prospect | Run scan | `POST /api/owner/prospects/[id]/scan` | **Real** |
| Find contact | Extract email | `POST /api/owner/prospects/[id]/contact` | **Real** |
| Generate outreach | Create draft | Prospect pipeline | **Real** |
| Archive / Ignore | Pipeline update | `PATCH /api/owner/prospects/[id]` | **Real** |

---

## Customers

| Label | Expected | API | Status |
|-------|----------|-----|--------|
| Send retention / upgrade | Queue via inbox approval | `POST /api/owner/inbox` | **Real** |
| Mark status | Update customer | `PATCH /api/owner/customers/[userId]` | **Real** |
| Open Success | Navigate | `setSection('success')` | **Real** |

---

## Success

| Label | Expected | Status |
|-------|----------|--------|
| View at-risk / expansion | Read-only display | **Real** — actions live in Inbox |
| Refresh | Reload founder data | **Real** |

---

## Settings

| Label | Expected | API | Status |
|-------|----------|-----|--------|
| Save settings | Outreach + autopilot + archive | `PUT /api/owner/settings` | **Real** |
| Growth autopilot mode | manual / assisted / limited / paused | `growth_autopilot` settings key | **Real** |
| Warmup week caps | 10/20/40 daily max | `deliverabilityGuard` | **Real** |
| Account & password | Link to `/dashboard/settings` | **Real** |

---

## Cron (owner-only)

| Route | Schedule | Behavior |
|-------|----------|----------|
| `/api/cron/growth-autopilot` | 04:00 UTC | Prepare-only: discover, scan, draft, follow-ups — **no auto-send by default** |
| `/api/cron/prospect-discovery` | 03:00 UTC | Legacy discovery + scan (kept) |

Both require `CRON_SECRET` via `isWorkerAuthorized`.

---

## Send gates (all paths)

1. `require_approval` + `{ approved: true }` at call site
2. `deliverabilityGuard` — DNS, bounce/unsub rates, daily cap
3. `outreachCopyGuard` — no fear/spam copy
4. `conversionPathGuard` — /agency, /summary, /signup must exist
5. Suppression / unsubscribe check
6. 30-day cooldown, duplicate prevention

---

## Dead / orphan (not in active nav)

These components exist but are **not linked** from Founder OS nav:

- `OverviewView`, `OutreachView`, `CrmView`, `InsightsView`
- `AutopilotCommandCenter` (standalone panel — inbox uses `FounderInboxList` only)
- `ExecutionCommandBanner`, `FounderInboxSection`, `AiChiefOfStaff`

**Action:** left unmounted intentionally to avoid fake panels. Verify scripts assert active nav only.

---

## Not automated (by design)

- Unlimited cold email blast
- Auto-send without approval (default)
- Limited autopilot send (Mode 3) — code path exists but **disabled in cron**
- Global auto-send without compliance review
- Emails during this sprint
