#!/usr/bin/env node
/**
 * Dev-only guide for verifying security alert emails.
 *
 * Prerequisites:
 *   - RESEND_API_KEY set in .env.local
 *   - Local dev server running (npm run dev)
 *   - A website with a low security score target (e.g. http://example.com)
 *
 * Steps:
 *   1. Log in to the dashboard and add http://example.com if not present.
 *   2. Trigger a scan via the UI or:
 *        curl -X POST http://localhost:3000/api/scan \
 *          -H "Content-Type: application/json" \
 *          -H "Cookie: <your-session-cookie>" \
 *          -d '{"websiteId":"<website-uuid>"}'
 *   3. Wait for Vercel Cron or POST /api/scan/enqueue-or-process-batch (with CRON_SECRET).
 *   4. Check server logs for:
 *        [sendSecurityAlert] Email sent for alert=...
 *   5. Verify in Resend dashboard (https://resend.com/emails) and your inbox.
 *
 * Alert criteria: security_score < 60 creates a security_issue alert and sends email.
 * Cooldown: at most one alert email per website per 24 hours.
 *
 * This script does NOT send email — it only documents the manual test flow.
 */

console.log(`
CyberShield — Alert Email Test Guide (dev only)
===============================================

1. Ensure RESEND_API_KEY is set in .env.local
2. Run: npm run dev
3. Scan a low-score site (http://example.com is ideal — missing security headers)
4. Process queue: POST /api/scan/enqueue-or-process-batch (Bearer CRON_SECRET)
5. Look for [sendSecurityAlert] Email sent in server logs
6. Confirm delivery in Resend dashboard + inbox

Do NOT run this script in CI.
`);
