# CyberShield Email Infrastructure Audit

Generated: 2026-06-20 · Branch: `checkpoint/email-infrastructure`

## Executive summary

CyberShield sends email via **Resend**. Before this sprint, delivery worked but infrastructure was immature: single root-domain sender, no DMARC, no plain-text, no engagement tracking, inconsistent footers, and AI-sounding outreach copy.

This sprint adds code infrastructure for professional deliverability. **DNS records must be applied manually** (see fixes below).

---

## DNS & authentication

| Record | Current state | Risk | Recommended fix |
|--------|---------------|------|-----------------|
| **SPF** | May exist on root; sending subdomain needs own SPF | Medium | `mail.cybershieldcloud.com` TXT: `v=spf1 include:amazonses.com ~all` |
| **DKIM** | Resend provides CNAME/TXT on verify | Medium | Verify `mail.cybershieldcloud.com` in Resend → publish DKIM records |
| **DMARC** | **Missing** (Resend reports none) | **High** | `_dmarc.cybershieldcloud.com` TXT: `v=DMARC1; p=none; rua=mailto:dmarc@cybershieldcloud.com` |
| **Sending subdomain** | `alerts@cybershieldcloud.com` (root) | Medium | Migrate to `mail.cybershieldcloud.com` segmented addresses |
| **links.cybershieldcloud.com** | Not configured | Low | CNAME → app host; set `EMAIL_USE_CUSTOM_TRACKING=true` |
| **track.cybershieldcloud.com** | Not configured | Low | CNAME → app host for open pixels |

### DMARC rollout (do not skip to reject)

1. **Stage 1 (now):** `p=none` — monitor only  
2. **Stage 2 (after 2–4 weeks clean):** `p=quarantine`  
3. **Stage 3 (after 30+ days clean):** `p=reject`

---

## Resend configuration

| Item | State | Notes |
|------|-------|-------|
| API key | Env `RESEND_API_KEY` | Required in Vercel production |
| From address | `EMAIL_FROM` or category defaults | Code now supports per-category senders on `mail.` subdomain |
| Webhook | **New:** `/api/resend/webhook` | Set `RESEND_WEBHOOK_SECRET`; configure in Resend dashboard |
| Sandbox fallback | Dev uses `resend.dev` | Customer delivery blocked until domain verified |

---

## Email categories & senders

| Category | Sender (production default) | Use |
|----------|----------------------------|-----|
| outreach / follow_up | `outreach@mail.cybershieldcloud.com` | Founder OS prospect emails |
| onboarding / retention / upgrade | `success@mail.cybershieldcloud.com` | Customer lifecycle |
| alert / system | `alerts@mail.cybershieldcloud.com` | Monitoring alerts |
| report | `reports@mail.cybershieldcloud.com` | Digests & reports |

Override per category: `EMAIL_FROM_OUTREACH`, `EMAIL_FROM_ONBOARDING`, etc.

---

## Tracking

| Type | Implementation | Domain |
|------|----------------|--------|
| **Click tracking** | `/api/email/click` wraps links | `links.cybershieldcloud.com` (or app fallback) |
| **Open tracking** | 1×1 pixel `/api/email/open` | `track.cybershieldcloud.com` (or app fallback) |
| **Attribution** | Signup token in outreach links | Preserved through click wrapper |
| **Resend events** | Webhook → `owner_email_engagement_events` | delivered, opened, clicked, bounced, complained |

---

## Templates audited

| Category | File(s) | Before | After |
|----------|---------|--------|-------|
| Outreach | `lib/owner/generators/outreach.ts` | Generic AI copy, placeholder signature | Specific findings, business context, attribution CTA |
| Outreach send | `lib/owner/outreachExecution.ts` | Plain `<pre>` HTML | Standard HTML + plain text + footer |
| Retention/onboarding | `lib/owner/retentionOutreach.ts` | Basic HTML | Standard template + compliance footer |
| Alerts | `lib/sendAlertEmail.ts`, `lib/alerts/*` | Custom HTML each | **Not refactored this sprint** — use shared template next |
| Funnel | `lib/email/funnel.ts` | Custom | **Not refactored** |
| Enterprise | `lib/email/enterpriseLead.ts` | Custom | **Not refactored** |

---

## Footer compliance (implemented)

All emails through `buildEmailDocument()` include:

- CyberShield Cloud branding  
- Website link  
- Reply-to address (category-specific)  
- Reason recipient received email  
- Unsubscribe instructions (outreach/retention)  
- Privacy + Terms links  

---

## Automation safety (verified in code)

| Rule | Status |
|------|--------|
| No send without approval (outreach) | ✓ `require_approval` setting |
| No send without contact email | ✓ `outreachExecution.ts` |
| Cooldown (30d) on initial outreach | ✓ Follow-ups exempt |
| No send to archived/ignored | ✓ Pipeline checks |
| No send to existing customers as prospects | ✓ `isCustomerEmail()` |
| Daily send limit | ✓ `daily_outreach_limit` |
| Every send logged | ✓ `owner_email_deliveries` |
| Failures logged | ✓ draft status + events |

---

## Attribution chain

```
Outreach email → click (tracked) → signup (token captured) → interested → paid conversion → customer
```

Stored in `owner_prospect_attributions` with `source_template`, `source_campaign`, `source_email_category`.

---

## Founder OS surfaces

- **Email intelligence (today):** sent, delivered, opened, clicked, bounced, conversions  
- **Email health:** SPF, DKIM, DMARC, tracking domains, bounce rate, Resend config  

---

## Manual actions required (production)

1. Add DMARC TXT record (Stage 1)  
2. Verify `mail.cybershieldcloud.com` in Resend  
3. Publish SPF + DKIM for sending subdomain  
4. CNAME `links` and `track` subdomains  
5. Set Vercel env vars (see `.env.example`)  
6. Configure Resend webhook → `https://cybershieldcloud.com/api/resend/webhook`  
7. Apply migration `20260620100000_email_infrastructure.sql`  

---

## Remaining gaps

- Alert/monitoring emails not yet on shared template system  
- Resend native click/open tracking vs custom pixels (dual tracking possible — monitor for duplicates)  
- Reply tracking requires inbound email parsing (future: Resend inbound or support@ mailbox)  
- DMARC upgrade to quarantine/reject is manual DNS change after monitoring period  
