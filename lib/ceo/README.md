# CyberShield CEO System

**ADVISORY / DECISION-SUPPORT ONLY** — safe for production.

## What this layer does

- Aggregates daily business metrics from profiles, events, scans, enterprise leads, referrals, and viral events
- Generates rule-based insights and recommendations for the owner dashboard
- Raises alerts when KPIs cross thresholds (conversion drops, checkout friction, enterprise surges, MRR decline)
- Surfaces churn risk counts (read-only; brain retention handles emails separately)

## What this layer NEVER does

- **Never** changes Stripe prices, products, or subscriptions
- **Never** modifies auth, roles, or permissions
- **Never** alters database schema automatically
- **Never** auto-applies recommendations — the only write path is an explicit admin **"Apply suggestion"** click
- **Never** sends retention emails (that is the brain layer's job)

## Manual apply flow

1. Owner runs **Run analysis** on `/dashboard/admin/ceo-dashboard`
2. Recommendations are stored in `autopilot_config.ceo_recommendations`
3. Owner clicks **Apply suggestion** on a single item
4. `applyRecommendation()` updates only whitelisted `autopilot_config` keys (same whitelist as `lib/brain/safety.ts`)
5. Action is logged to `audit_logs` with `ceo_recommendation_applied`

## Whitelisted config keys

See `lib/brain/safety.ts` — `ALLOWED_CONFIG_KEYS` including `highlighted_plan`, `cta_text_variant`, `paywall_delay_ms`, `pricing_layout_order`, etc.

## Integration with Final Boss brain

- **Brain** optimizes and can auto-run on schedule
- **CEO** sits on top as the strategic advisory layer — recommends, does not execute
- Both share the same safe `autopilot_config` key whitelist for manual apply
