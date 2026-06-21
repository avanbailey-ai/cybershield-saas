# Claims-to-Code Audit — CyberShield Cloud

**Audit date:** June 2026  
**Scope:** Public marketing, pricing, scan engine, monitoring, alerts, reports, agency/enterprise, dashboard, legal, SEO  
**Method:** Cross-reference public-facing copy against `lib/scanner/`, `lib/billing/`, `lib/jobs/`, `lib/alerts/`, `app/api/`, and UI components.

**Registry:** Approved/banned phrases and plan facts live in `lib/marketing/claims.ts`.

---

## Executive summary

| Area | Verdict |
|------|---------|
| Free scan | **Verified** — deep scan runs; preview limited to 2 issue headlines (`FREE_ISSUE_LIMIT=2` in `app/api/scan/public/route.ts`) |
| Paid monitoring cadence | **Verified** — Pro 24h, Growth 1h, Agency 1h + 25×5min priority (`lib/jobs/scanFrequency.ts`) |
| Plan limits (10/50/250) | **Verified** — enforced on website create (`app/api/websites/route.ts`, `core/billing/plans.ts`) |
| Scan checks | **Partial** — 14 header/HTML/TLS rules; not malware/CVE/pen-test |
| Email alerts | **Verified** — Resend pipeline; instant for critical events; digest for lower severity |
| Reports | **Verified** — HTML reports from scan data; agency `.txt` copy export; org PDF for agency admins |
| Enterprise SSO/SOC2 | **Not implemented** — sales-led only; copy reworded |
| Case study metrics | **Removed** — now illustrative scenarios |

---

## 1. Public marketing

| Claim | Location | Status | Evidence | Action taken |
|-------|----------|--------|----------|--------------|
| Continuous monitoring from free scan | `Hero.tsx`, `HowItWorks.tsx` | Verified | Free scan + paid gating in `featureGate.ts` | None |
| Alerts before browser warnings | `Hero.tsx`, `TrustBar.tsx` | Needs reword | SSL expiry alerts exist; not all issues precede browser warnings | Reworded to "when supported issues are detected" |
| Malicious changes / malware | `Features.tsx` (was) | Needs reword | No malware engine | Reworded to configuration/HTTP changes |
| Around-the-clock monitoring | `lib/seo/features.ts` (was) | Needs reword | Pro=daily, not 24/7 probes | Reworded to plan-based schedule |
| Unauthorized changes | `lib/seo/features.ts` (was) | Needs reword | Change detection, not authorization proof | Reworded to "configuration changes" |
| White-label reports | `lib/seo/features.ts` (was) | Needs reword | Manual copy export only | Reworded to client-ready copy exports |
| Top 3 free findings | `Pricing.tsx` (was) | Needs reword | Code shows 2 | Updated to top 2 |
| 30-day money-back guarantee | `Pricing.tsx`, `UpgradeModal.tsx` | Needs reword | Refund policy is case-by-case | Aligned with `/refund-policy` |
| Exploit scenarios (public upsell) | `scan-result/[id]`, paywall | Needs reword | Paid reports use risk context field | Public copy → "risk context" |

---

## 2. Pricing & plans

| Claim | Location | Status | Evidence | Action taken |
|-------|----------|--------|----------|--------------|
| Pro $79 / 10 sites / daily | `planFeatures.ts`, Stripe | Verified | `PLAN_LIMITS.pro`, `scanFrequency.ts` | None |
| Growth $149 / 50 / hourly | Same | Verified | `websites: 50`, 60min interval | None |
| Agency $299 / 250 / priority 5min | Same | Verified | `priorityMonitoringSlots: 25` | None |
| Enterprise custom | `Pricing.tsx`, enterprise pages | Verified | Mailto + lead form, no checkout | None |
| Free ongoing monitoring | `Pricing.tsx` free tier | Verified | Explicit "no continuous monitoring" | None |
| Manual deep scan limits | Plan bullets | Verified | `maxScansPerDay` in `plans.ts`, `enforceScan.ts` | None |
| Stripe price authority | Display prices | Verified | `stripeDisplayPrices.ts` may differ from $79/$149/$299 | Note in registry |

---

## 3. Scanning engine

| Claim | Location | Status | Evidence | Action taken |
|-------|----------|--------|----------|--------------|
| Security headers (6) | Marketing, reports | Verified | `intelligenceCards.ts` — presence only | None |
| SSL/TLS expiry | Marketing | Verified | `probeCertificate.ts`, SSL cron | None |
| Malware / blacklist | Not in current legal pages | Removed | No implementation | Do not add |
| CVE / plugin scanning | Not claimed post-audit | Removed | Heuristic CMS strings only | None |
| Penetration testing | Enterprise form (was) | Removed | No active testing | Checkbox → inquiry topics |
| Attack surface mapping | Free tier negative | Verified | `attackSurface.ts` exists; limited on free | Keep as "not included" |
| Multi-page crawl | Implied by "full site" | Not implemented | Single URL only | Avoid implying full-site crawl |
| Header value validation | — | Not implemented | Presence checks only | Internal note |

**Implemented checks (14 rules):** `ssl_missing`, `csp_missing`, `hsts_missing`, `xframe_missing`, `xcontenttype_missing`, `referrer_missing`, `permissions_missing`, `external_scripts`, `third_party_dependencies`, `login_surface`, `admin_endpoints`, `auth_endpoints`, `analytics_tracking`, `external_api_calls` — see `lib/securityIntelligence/intelligenceCards.ts`.

---

## 4. Monitoring & cron

| Claim | Location | Status | Evidence | Action taken |
|-------|----------|--------|----------|--------------|
| Pro daily monitoring | Pricing, FAQ | Verified | 1440min `daily_scan` | None |
| Growth hourly | Pricing | Verified | 60min interval | None |
| Agency 5min priority | Agency landing | Verified | `hourly_monitor` + priority flag | None |
| Weekly deep scan | Plan copy | Verified | `monitoringScanKind.ts` 7-day deep | None |
| Free plan cron scans | — | Verified blocked | `isDueForScheduledScan('free')` false | None |
| Dedicated uptime probes | Health/uptime copy | Partial | HTTP status from scans | SEO/features reworded |

---

## 5. Alerts & email

| Claim | Location | Status | Evidence | Action taken |
|-------|----------|--------|----------|--------------|
| Email alerts (paid) | Plan bullets | Verified | `emailPipeline.ts`, `planAllowsMonitoringEmail` | None |
| Instant / real-time alerts | Sequences (was) | Needs reword | Critical instant; others digest | Reworded sequences + templates |
| Before attackers do | `funnel.ts` (was) | Removed | Not supportable | Reworded |
| Resend delivery | — | Verified | `lib/email.ts` | None |
| Alert daily cap | — | Verified | Default 3/day in prefs | None |
| Support email addresses | Legal/contact | Verified | `lib/seo/constants.ts` | None |

---

## 6. Reports

| Claim | Location | Status | Evidence | Action taken |
|-------|----------|--------|----------|--------------|
| Full reports (paid) | Pricing, `gateReport` | Verified | `lib/accessControl.ts` | None |
| HTML report per scan | `/report/[id]` | Verified | Real scan rows | None |
| PDF per scan | — | Not implemented | No route | Do not claim |
| Agency client-ready reports | Agency panel | Verified | Copy/`.txt` export, no auto email | SEO reworded |
| Org PDF export | Enterprise exports | Verified | `generateEnterpriseReportPDF.ts` | SOC2 disclaimer kept in PDF |
| Deterministic (not LLM) reports | Internal | Verified | `lib/ai/buildReport.ts` | Do not claim "AI fixes" |
| AI remediation auto-fix | — | Not implemented | Guidance only | Banned in registry |

---

## 7. Agency

| Claim | Location | Status | Evidence | Action taken |
|-------|----------|--------|----------|--------------|
| Agency dashboard | `/dashboard/enterprise` | Verified | `canAccessAgencyDashboard()` | None |
| 250 website limit | Landing, plans | Verified | Enforced on create | None |
| Client organization | Agency UI | Verified | `client_name` on websites | None |
| Portfolio monitoring | Agency dashboard | Verified | `fetchAgencyData.ts` | None |
| Auto email to clients | — | Not implemented | Copy-only panel | Clarified in SEO |
| Prevents client incidents | Agency dashboard (was) | Needs reword | Monitoring only | Reworded |

---

## 8. Enterprise

| Claim | Location | Status | Evidence | Action taken |
|-------|----------|--------|----------|--------------|
| Contact sales / lead form | `/enterprise/review` | Verified | `POST /api/enterprise/leads` | None |
| SOC2-ready architecture | `TrustSignals` (was) | Removed | Not certified | Reworded |
| SSO self-serve | Enterprise pricing (was) | Needs reword | `isSSOEnabled()` false | Custom inquiry only |
| Unlimited websites (onboarding was) | `onboarding/page.tsx` | Needs reword | Agency cap 250 | Fixed copy |
| Vulnerability assessment tier | Enterprise pricing (was) | Removed | Not pen-test | Config review wording |
| Case study % reductions | `caseStudies.ts` (was) | Removed | Unverified | Illustrative scenarios |
| Audit log UI | Marketing (was) | Partial | `audit_logs` writes, no viewer | Reworded to scan history |
| Team invite email | — | Needs implementation | Placeholder in API | Future work |

---

## 9. Dashboard metrics

| Claim | Location | Status | Evidence | Action taken |
|-------|----------|--------|----------|--------------|
| Command center from DB | Dashboard | Verified | `fetchCommandCenterData.ts` | None |
| Sites online | `CyberShieldValueSummary` (was) | Needs reword | Counts score ≥70 | Label → "Sites healthy" |
| Downtime events | Dashboard | Partial | Failed scans, not uptime SLA | Internal note |
| Industry percentile benchmark | API only | Mock | `benchmarking.ts` MOCK data | Not shown in customer UI |
| Founder OS metrics | Owner admin | Verified | Real subscriptions, QA filtered | Out of public scope |

---

## 10. Legal & support

| Claim | Location | Status | Evidence | Action taken |
|-------|----------|--------|----------|--------------|
| Terms / Privacy / Refund / AUP / Disclaimer | `/terms`, etc. | Verified | Pages exist with careful language | None |
| No security guarantee | Disclaimer, FAQ | Verified | Explicit negation | None |
| Contact emails | `/contact` | Verified | support/sales/partners/outreach | None |
| Authorized scanning only | AUP, FAQ | Verified | Matches product intent | None |

---

## 11. SEO & metadata

| Claim | Location | Status | Evidence | Action taken |
|-------|----------|--------|----------|--------------|
| Sitemap public routes | `app/sitemap.ts` | Verified | Legal + marketing routes | None |
| Robots disallow app routes | `app/robots.ts` | Verified | Login/dashboard excluded | None |
| Homepage positioning | `app/page.tsx` | Verified | Matches implemented scope | None |
| Feature page exaggeration | `lib/seo/features.ts` | Reworded | See section 1 | Updated |

---

## 12. Authentication & billing gating

| Claim | Location | Status | Evidence | Action taken |
|-------|----------|--------|----------|--------------|
| Paid monitoring requires active sub | — | Verified | `featureGate.ts`, `enforceScan.ts` | None |
| Stripe webhook → plan | — | Verified | `app/api/stripe/webhook/route.ts` | Not modified |
| RLS / org isolation | — | Verified | Supabase org scoping | Not modified |

---

## Needs implementation later (not falsely advertised)

1. **SSO/SAML** — inquiry only until `lib/auth/sso.ts` implemented  
2. **Audit log viewer / export UI** — backend writes exist  
3. **Team invite email delivery** — invite row only  
4. **Per-scan PDF download** — org-level PDF exists for agency admins  
5. **Dedicated uptime monitoring** — currently scan-derived HTTP status  
6. **Header value quality analysis** — presence-only today  
7. **White-label branded report PDFs**

---

## Manual verification recommended

1. Run a live free scan at `/scan` — confirm 2 issue preview and blurred remediation  
2. Stripe checkout Pro/Growth/Agency in test mode — prices match env Price objects  
3. Add 11th website on Pro — expect `WEBSITE_LIMIT_REACHED`  
4. Trigger critical SSL alert on paid account — confirm Resend delivery  
5. Confirm production emails (support@, sales@) receive mail  

---

## Files changed in this audit pass

See git diff. Key areas: `components/enterprise/TrustSignals.tsx`, `app/enterprise/pricing/page.tsx`, `lib/sales/caseStudies.ts`, `lib/seo/features.ts`, landing components, conversion/email copy, `lib/marketing/claims.ts`, `components/dashboard/CyberShieldValueSummary.tsx`.

---

## Maintenance

Before adding marketing copy, check `lib/marketing/claims.ts` (`BANNED_PHRASES`, `PLAN_CLAIMS`, `IMPLEMENTED_SCAN_CHECKS`). Re-run this audit when adding new plan tiers or scan checks.
