# Founder OS V6 — Usefulness Audit

**Date:** 2026-06-18  
**Branch:** `checkpoint/founder-os-v6`  
**Perspectives:** Founder (revenue & decisions), Customer (value received), Agency (scale & ops)

## Executive Summary

V6 removes homepage clutter, wires real Supabase signals into health/expansion/risk engines, and makes inbox approvals execute automation. Target usefulness: **8.5+** on action pages.

---

## Page-by-Page Audit

### Home (`FounderHomeView`)

| Perspective | V5 issue | V6 change |
|-------------|----------|-----------|
| Founder | 8-metric grid duplicated MRR/customer counts; pipeline + revenue engine buried the lead | **4-metric glance**: MRR, 24h changes, attention count, revenue at risk |
| Founder | "While away" was aggregate counters, not a timeline | **Activity feed** with real timestamps |
| Customer | N/A (owner-only) | — |
| Agency | Vanity pipeline chips on home | Moved to Prospects |

**Removed filler:** ARR tile, duplicate customer success grid, revenue engine block, pipeline chips, market intelligence teaser.

**Usefulness score: 9.0** — Answers money, what changed, best opportunity, and attention in ~10 seconds.

---

### Inbox (`FounderInboxView`)

| Perspective | V5 issue | V6 change |
|-------------|----------|-----------|
| Founder | Approvals were acknowledge-only | **POST executes**: outreach send/queue, retention schedule, expansion tasks |
| Founder | Flat list | Filter chips: outreach, risk, upgrades, signups |
| Agency | No revenue context on risk items | Revenue-at-risk banner |

**Usefulness score: 9.0** — Actionable approval queue with execution feedback.

---

### Success (`CustomerSuccessView`) — NEW

| Perspective | V5 issue | V6 change |
|-------------|----------|-----------|
| Founder | Health was 4 counters on home | Full health scores, ✓/✗ factors, recommended actions |
| Founder | Expansion was heuristic email matching | **Expansion engine** with probability + MRR gain |
| Customer | No visibility (internal) | Health based on login, scans, monitoring, SSL |
| Agency | Churn risk without $ impact | **Revenue at risk** with suggested actions |

**Usefulness score: 9.2** — Primary retention and expansion command center.

---

### Prospects (`ProspectsView` + `LeadDiscovery`)

| Perspective | V5 issue | V6 change |
|-------------|----------|-----------|
| Founder | Junk in discovery | `isJunkProspect()` + expanded deprioritize keywords |
| Founder | Contact buried in reasons | Contact info **first** in qualification reasons |
| Agency | Weak opportunity copy | ✉/☎/✗ contact prominence |

**Usefulness score: 8.6** — Still room for contact-enrichment UX polish.

---

### Customers (`CustomersView`)

| Perspective | V5 issue | V6 change |
|-------------|----------|-----------|
| Founder | Overlaps Success metrics | Kept for content performance + CEO advisory; Success owns health |
| Customer | Generic churn tiles | Unchanged — consider merging into Success later |

**Usefulness score: 7.5** — Useful but partially redundant with Success; acceptable for V6.

---

### Settings (`SettingsView`)

| Perspective | V5 issue | V6 change |
|-------------|----------|-----------|
| Founder | Config only | Unchanged |

**Usefulness score: 8.0** — MRR goal and founder preferences.

---

## Vanity / Duplicate Flags (V5 → V6)

| Item | Verdict | V6 action |
|------|---------|-----------|
| MRR on home + business status + CEO dashboard | Duplicate | Single MRR on home glance |
| Customer healthy/at-risk on home + Customers | Duplicate | Home links to Success |
| Pipeline stages on home + Prospects | Duplicate | Removed from home |
| Chief of Staff generic bullets | Filler | Fed from activity feed events |
| whileAway numeric buckets | Weak | Replaced with ActivityFeed |
| Autopilot stats without execution | Vanity | Wired to inbox automation |

---

## Engines Added (V6)

| Engine | Path | Data sources |
|--------|------|--------------|
| Customer Health | `lib/owner/customerHealth.ts` | profiles, scans, websites, ssl_certificates, subscriptions, ai_report_cache |
| Revenue at Risk | `lib/owner/revenueAtRisk.ts` | health + subscriptions past_due |
| Expansion | `lib/owner/customerExpansion.ts` | profiles, websites, scans, plan limits |
| Activity Feed | `lib/owner/activityFeed.ts` | discovery runs, scans, prospects, drafts, signups |
| Inbox Automation | `lib/owner/inboxAutomation.ts` | drafts, email_queue, campaign tasks, retention |

---

## Usefulness Scores (Target 8.5+)

| Page | Score | Reasoning |
|------|-------|-----------|
| Home | **9.0** | Focused 10-second briefing; clutter removed |
| Inbox | **9.0** | Filters + real automation |
| Success | **9.2** | Health, risk, expansion in one place |
| Prospects | **8.6** | Better qualification; discovery UX unchanged |
| Customers | **7.5** | Partial overlap with Success |
| Settings | **8.0** | Functional config |
| **Weighted avg (action pages)** | **8.9** | Meets 8.5+ target |

---

## Automation Gaps (honest)

1. **`founder_follow_up` email template** — Queued in `email_queue` but not yet handled by `processEmailWorker` (only retention + follow_up_24h today). Requires worker handler for full send.
2. **Stripe card expiry** — No local payment-method expiry field; V6 uses `subscriptions.status = past_due` as proxy (Layer 0 Stripe not modified).
3. **MRR change events** — Activity feed uses plan updates as proxy; no dedicated MRR audit log table.

---

## Verification

```bash
npx tsx scripts/verify-founder-os-v6.ts
npx tsc --noEmit
npm run build
```
