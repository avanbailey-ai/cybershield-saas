/**
 * Agency Prospect System verification (Founder OS, owner-only).
 *
 * Verifies the owner-only "Agency Client Discovery & Outreach Generator":
 *   1.  agency prospects get an agency-specific classification (prospect_kind + columns)
 *   2.  an agency opportunity score (separate from the SMB score) exists
 *   3.  a separate agency outreach generator exists
 *   4.  agency emails do NOT open with raw scanner findings
 *   5.  agency emails explain client-site monitoring / reporting value
 *   6.  agency emails include a tracked prospect CTA link (plan=agency, source=agency_outreach)
 *   7.  agency emails require manual approval (no send without approved=true)
 *   8.  there is no auto-send path (drafts are created, never sent automatically)
 *   9.  duplicate-send prevention exists (cooldown / already-sent guard)
 *   10. follow-up dedupe is still enforced
 *   11. the SMB outreach generator still works
 *   12. the existing Case Coffee outreach flow is not broken
 *
 * Static checks read source files; generator checks run the real generators.
 * An optional live DB scan runs only when Supabase service creds are present.
 *
 * Run: npx tsx scripts/verify-agency-prospect-system.ts
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  generateAgencyOutreach,
  AGENCY_VALUE_PROP,
  AGENCY_MONITORING_EXPLANATION,
  AGENCY_PLAN_MENTION,
} from '../lib/owner/agency/agencyOutreach';
import {
  computeAgencyOpportunityScore,
  agencyLabelFromScore,
  scoreAgency,
  decideProspectKind,
  AGENCY_PLAN_PRICE,
} from '../lib/owner/agency/agencyScore';
import { detectAgencySignalsFromHtml } from '../lib/owner/agency/agencyDetect';
import { buildAgencyAttributionUrl } from '../lib/owner/prospectAttribution';
import { generateOutreach } from '../lib/owner/generators/outreach';

const problems: string[] = [];
function assert(condition: boolean, message: string): void {
  if (!condition) problems.push(message);
  else console.log(`OK: ${message}`);
}
function read(rel: string): string {
  const p = join(process.cwd(), rel);
  if (!existsSync(p)) {
    problems.push(`Missing file: ${rel}`);
    return '';
  }
  return readFileSync(p, 'utf8');
}

const SEVERITY_TAG = /\[(critical|high|medium|low|info|informational)\]/i;
const RAW_SCANNER_HEADER =
  /\bMissing (Content-Security-Policy|Referrer-Policy|Permissions-Policy|Strict-Transport-Security|X-Frame-Options|X-Content-Type-Options|HSTS)\b/i;

function bodyOf(content: string): string {
  const m = content.match(/^Subject:.*?(?:\n|$)/i);
  return m ? content.slice(m[0].length).trim() : content.trim();
}
function firstParagraph(body: string): string {
  const paras = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paras.length === 0) return '';
  if (/^hi\b/i.test(paras[0]) && paras[0].length < 40 && paras.length > 1) return paras[1];
  return paras[0];
}

console.log('CyberShield agency prospect system verification\n');

// ── Sample agency prospect ──
const sampleHtml = `
  <html><head><title>Rogue Valley Web Studio</title></head><body>
  <h1>WordPress & Shopify web design agency</h1>
  <p>We build and manage client websites and offer website care plans, hosting, and SEO.</p>
  <a href="/portfolio">Our work</a> — 40+ client projects.
  <a href="mailto:hello@roguevalleywebstudio.com">Email us</a>
  <div class="testimonial">What our clients say</div>
  </body></html>`;
const sampleSignals = detectAgencySignalsFromHtml(sampleHtml);

const agencyInput = {
  agencyName: 'Rogue Valley Web Studio',
  website: 'https://roguevalleywebstudio.com',
  agencyType: 'web_design' as const,
  detectedServices: sampleSignals.detectedServices,
  estimatedSiteCount: 40,
  managesClientSites: true,
  city: 'Medford',
  signupUrl: buildAgencyAttributionUrl('SAMPLETOKEN1234'),
};

// ── 1. Agency-specific classification ──
const enrichmentSrc = read('lib/owner/agency/agencyEnrichment.ts');
assert(
  /classifyAgencyProspect/.test(enrichmentSrc) &&
    /decideProspectKind/.test(enrichmentSrc) &&
    /prospect_kind:\s*kind/.test(enrichmentSrc) &&
    /agency_type/.test(enrichmentSrc) &&
    /agency_label/.test(enrichmentSrc) &&
    /detected_services/.test(enrichmentSrc),
  'Agency prospects get an agency-specific classification (prospect_kind via decideProspectKind + agency columns)',
);
assert(
  sampleSignals.managesClientSites === true && sampleSignals.detectedServices.length > 0,
  'Agency detection extracts real signals (manages client sites + detected services)',
);

// ── 2. Agency opportunity scoring (separate from SMB) ──
const scoreResult = scoreAgency({
  businessName: agencyInput.agencyName,
  industry: 'web design',
  website: agencyInput.website,
  signals: sampleSignals,
  agencyType: 'web_design',
  hasContactEmail: true,
});
assert(
  typeof computeAgencyOpportunityScore === 'function' &&
    scoreResult.score > 0 &&
    scoreResult.score <= 100 &&
    ['AGENCY HOT', 'AGENCY WARM', 'AGENCY LOW', 'NOT AGENCY FIT'].includes(scoreResult.label),
  `Agency opportunity scoring exists and labels correctly (score=${scoreResult.score}, label=${scoreResult.label})`,
);
const lowFit = agencyLabelFromScore(
  10,
  detectAgencySignalsFromHtml('<html><body>personal blog about my cat</body></html>'),
);
assert(lowFit === 'NOT AGENCY FIT', 'Low/no-evidence sites are labeled NOT AGENCY FIT');
const scoreSrc = read('lib/owner/agency/agencyScore.ts');
assert(
  !/salesIntelligence[^\n]*computeOpportunityScore/.test(scoreSrc),
  'Agency scoring is separate from the SMB computeOpportunityScore',
);

// ── 3. Agency outreach generator exists ──
const agencyEmail = generateAgencyOutreach(agencyInput);
const agencyEmailNoLink = generateAgencyOutreach({ ...agencyInput, signupUrl: null });
assert(
  typeof generateAgencyOutreach === 'function' && agencyEmail.startsWith('Subject: '),
  'Separate agency outreach generator exists and produces a parseable draft (starts with "Subject: ")',
);

// ── 4. Agency emails do NOT open with raw scanner findings ──
const opening = firstParagraph(bodyOf(agencyEmail));
assert(
  !SEVERITY_TAG.test(agencyEmail) &&
    !RAW_SCANNER_HEADER.test(opening) &&
    !SEVERITY_TAG.test(opening) &&
    /works with business websites/i.test(opening) &&
    !/recently reviewed|the review surfaced|scan score/i.test(opening),
  'Agency email leads with the agency business — no raw scanner findings in the opening',
);

// ── 5. Agency emails explain client-site monitoring / reporting value ──
assert(
  agencyEmail.includes(AGENCY_VALUE_PROP) &&
    agencyEmail.includes(AGENCY_MONITORING_EXPLANATION) &&
    /monitor/i.test(agencyEmail) &&
    /report/i.test(agencyEmail),
  'Agency email explains client-site monitoring + reporting value',
);

// ── 6. Tracked prospect CTA link (plan=agency, source=agency_outreach) ──
const attUrl = buildAgencyAttributionUrl('TESTTOKEN12345');
assert(
  agencyEmail.includes(agencyInput.signupUrl!) &&
    /\/summary\?/.test(attUrl) &&
    /plan=agency/.test(attUrl) &&
    /source=agency_outreach/.test(attUrl) &&
    /prospect=/.test(attUrl),
  'Agency email embeds a tracked CTA link and buildAgencyAttributionUrl encodes summary + plan=agency + source=agency_outreach + prospect token',
);
assert(
  agencyEmail.includes(AGENCY_PLAN_MENTION) && AGENCY_PLAN_PRICE === 299,
  'Agency email mentions the Agency plan / multi-site monitoring naturally',
);
const execSrc = read('lib/owner/outreachExecution.ts');
assert(
  /buildAgencyAttributionUrl/.test(execSrc) &&
    /prospect_kind === 'agency'|prospect\?\.prospect_kind === 'agency'/.test(execSrc) &&
    /agency_outreach/.test(execSrc),
  'Send pipeline routes agency drafts to the agency tracked link + agency_outreach source',
);

// ── 7. Manual approval required ──
assert(
  /settings\.require_approval && options\.approved !== true/.test(execSrc) &&
    /Approval required before send/.test(execSrc),
  'Agency emails require manual approval (no send without approved=true)',
);
const sendRouteSrc = read('app/api/owner/outreach/[id]/send/route.ts');
assert(
  /sendApprovedOutreach\(admin, id, \{ approved: true \}\)/.test(sendRouteSrc),
  'Send only happens through the owner-approved send route',
);

// ── 8. No auto-send path ──
const ensureSrc = read('lib/owner/ensureOutreachDraft.ts');
const bulkSrc = read('app/api/owner/prospects/bulk/route.ts');
const draftSrc = read('lib/owner/agency/agencyDraft.ts');
assert(
  /status: 'draft'/.test(ensureSrc) &&
    !/sendApprovedOutreach|sendEmail/.test(ensureSrc) &&
    !/sendApprovedOutreach|sendEmail/.test(bulkSrc) &&
    !/sendApprovedOutreach|sendEmail/.test(draftSrc),
  'Agency + SMB draft creation never auto-sends (creates status=draft only)',
);
assert(
  /AGENCY_OUTREACH_TYPE/.test(ensureSrc) && /AGENCY_OUTREACH_TYPE/.test(bulkSrc),
  'Agency prospects are routed to the agency generator during draft creation',
);

// ── 9. Duplicate-send prevention ──
assert(
  /withinCooldown/.test(execSrc) &&
    /COOLDOWN_DAYS/.test(execSrc) &&
    /draft\.status === 'sent'/.test(execSrc),
  'Duplicate-send prevention exists (cooldown + already-sent guard) and applies to agency drafts',
);

// ── 10. Follow-up dedupe still enforced ──
const schedulerSrc = read('lib/owner/followUpScheduler.ts');
assert(
  /existingStages/.test(schedulerSrc) && /existingStages\.has\(/.test(schedulerSrc),
  'Follow-up scheduler remains idempotent (dedupe enforced)',
);
assert(
  /if\s*\(draft\.outreach_type\s*!==\s*'follow_up'\)[\s\S]{0,200}scheduleFollowUps/.test(execSrc),
  'Follow-up cadence is only seeded by initial outreach (no cascade)',
);
const migDir = 'supabase/migrations';
const migrations = existsSync(join(process.cwd(), migDir))
  ? readdirSync(join(process.cwd(), migDir)).filter((f) => f.endsWith('.sql'))
  : [];
const hasFollowUpIndex = migrations
  .map((f) => read(join(migDir, f)))
  .some((sql) => /uniq_owner_follow_ups_active_stage/.test(sql));
assert(hasFollowUpIndex, 'DB unique index for active follow-up stage still present');

// ── Agency migration present ──
const hasAgencyMigration = migrations
  .map((f) => read(join(migDir, f)))
  .some(
    (sql) =>
      /prospect_kind/.test(sql) &&
      /agency_opportunity_score/.test(sql) &&
      /detected_services/.test(sql),
  );
assert(hasAgencyMigration, 'Agency prospects migration (prospect_kind + agency columns) exists');

// ── 11. SMB outreach generator still works ──
const smbEmail = generateOutreach('cold_email', {
  businessName: 'Acme Plumbing',
  website: 'https://acmeplumbing.com',
  industry: 'Contractors',
  scanScore: 68,
  issues: ['[MEDIUM] Missing Content-Security-Policy'],
  contactEmail: 'info@acmeplumbing.com',
});
assert(
  smbEmail.startsWith('Subject: ') &&
    /CyberShield Cloud monitors business websites/.test(smbEmail) &&
    !/works with business websites/i.test(firstParagraph(bodyOf(smbEmail))),
  'SMB outreach generator still works and is distinct from the agency generator',
);

// ── 12. Existing Case Coffee outreach flow not broken ──
const caseCoffee = generateOutreach('cold_email', {
  businessName: 'Case Coffee Roasters',
  website: 'https://www.casecoffeeroasters.com',
  industry: 'Hospitality',
  city: 'Ashland',
  scanScore: 72,
  riskLevel: 'medium',
  issues: [
    '[MEDIUM] Missing Referrer-Policy',
    '[MEDIUM] Missing Permissions-Policy',
    '[HIGH] Missing Content-Security-Policy',
  ],
  contactEmail: 'info@casecoffeeroasters.com',
});
const ccOpening = firstParagraph(bodyOf(caseCoffee));
assert(
  caseCoffee.startsWith('Subject: ') &&
    !SEVERITY_TAG.test(ccOpening) &&
    !RAW_SCANNER_HEADER.test(ccOpening) &&
    /hacked or compromised/i.test(caseCoffee),
  'Existing Case Coffee SMB outreach flow still produces a calm, business-first email',
);

// ── 13. Regression guards for the code-review fixes ──

// FIX 1 (HIGH): agency discovery must classify a prospect BEFORE the auto-scan /
// draft step, otherwise an agency prospect gets an SMB cold_email draft first
// and the agency draft is then skipped (a draft already exists).
const engineSrc = read('lib/owner/discovery/engine.ts');
const classifyIdx = engineSrc.indexOf('classifyAgencyProspect(admin, id');
const autoScanIdx = engineSrc.indexOf('scanProspect(admin, id)');
assert(
  classifyIdx > -1 && autoScanIdx > -1 && classifyIdx < autoScanIdx,
  'FIX 1: agency discovery classifies prospects BEFORE the auto-scan/draft step (no premature SMB draft)',
);
assert(
  /isAgencyProspect\(prospect\)/.test(ensureSrc) &&
    /buildAgencyDraftContent\(prospect\)/.test(ensureSrc) &&
    /AGENCY_OUTREACH_TYPE\s*:\s*'cold_email'/.test(ensureSrc),
  'FIX 1: ensureOutreachDraft is agency-aware (agency prospects get agency_email; SMB stays cold_email)',
);

// FIX 2 (MEDIUM): NOT AGENCY FIT (and weak) prospects must never be tagged agency.
assert(
  decideProspectKind({ label: 'NOT AGENCY FIT', managesClientSites: true }) === 'smb',
  'FIX 2: decideProspectKind NOT AGENCY FIT -> smb (never enters agency segment)',
);
const evidenceSignals = detectAgencySignalsFromHtml(
  '<html><body><h1>Web design agency</h1><p>We build websites for clients. Website care plans.</p></body></html>',
);
assert(
  decideProspectKind({ label: 'AGENCY HOT', managesClientSites: true, signals: evidenceSignals }) === 'agency' &&
    decideProspectKind({ label: 'AGENCY WARM', managesClientSites: true, signals: evidenceSignals }) === 'agency',
  'FIX 2: decideProspectKind AGENCY HOT / AGENCY WARM -> agency with service evidence',
);
assert(
  decideProspectKind({ label: 'AGENCY HOT', managesClientSites: null }) === 'smb' &&
    decideProspectKind({ label: 'AGENCY WARM', managesClientSites: false }) === 'smb',
  'FIX 2: AGENCY HOT/WARM without service evidence stays SMB',
);
assert(
  decideProspectKind({ label: 'AGENCY LOW', managesClientSites: true, signals: evidenceSignals }) === 'agency' &&
    decideProspectKind({ label: 'AGENCY LOW', managesClientSites: false }) === 'smb' &&
    decideProspectKind({ label: 'AGENCY LOW', managesClientSites: null }) === 'smb',
  'FIX 2: decideProspectKind AGENCY LOW -> agency only with real manages-client-sites evidence',
);
const notFitSignals = detectAgencySignalsFromHtml('<html><body>personal blog about my cat</body></html>');
const notFitScore = scoreAgency({
  businessName: 'Cat Blog',
  industry: null,
  website: 'https://catblog.example',
  signals: notFitSignals,
  agencyType: 'unknown',
  hasContactEmail: false,
});
assert(
  notFitScore.label === 'NOT AGENCY FIT' && decideProspectKind({ ...notFitScore, signals: notFitSignals }) === 'smb',
  'FIX 2: a fully-scored NOT AGENCY FIT prospect resolves end-to-end to prospect_kind=smb',
);

// Routing: agency prospects prefer the agency generator even when an SMB draft
// pre-exists (regenerate + bulk branch on prospect_kind / agency).
const regenSrc = read('app/api/owner/outreach/[id]/regenerate/route.ts');
assert(
  /isAgencyProspect\(prospect\)\s*\|\|\s*draft\.outreach_type === AGENCY_OUTREACH_TYPE/.test(regenSrc) &&
    /buildAgencyDraftContent\(prospect\)/.test(regenSrc),
  'Regenerate routes agency prospects to the agency generator (agency_email), not the SMB generator',
);
assert(
  /isAgencyProspect\(p\)/.test(bulkSrc) && /buildAgencyDraftContent\(p\)/.test(bulkSrc),
  'Bulk generate routes agency prospects to the agency generator',
);

// SMB outreach generation is unchanged for the agency-mode regression.
const smbRegression = generateOutreach('cold_email', {
  businessName: 'Acme Plumbing',
  website: 'https://acmeplumbing.com',
  industry: 'Contractors',
  scanScore: 68,
  issues: ['[MEDIUM] Missing Content-Security-Policy'],
  contactEmail: 'info@acmeplumbing.com',
});
assert(
  smbRegression.startsWith('Subject: ') &&
    /CyberShield Cloud monitors business websites/.test(smbRegression) &&
    !/works with business websites/i.test(firstParagraph(bodyOf(smbRegression))),
  'generateOutreach(cold_email, …) still returns SMB copy (agency fixes did not touch the SMB generator)',
);

// No auto-send in any draft-creation / classification / regenerate path.
assert(
  !/sendApprovedOutreach|sendEmail/.test(engineSrc) &&
    !/sendApprovedOutreach|sendEmail/.test(enrichmentSrc) &&
    !/sendApprovedOutreach|sendEmail/.test(regenSrc),
  'Discovery / classification / regenerate paths never auto-send (no sendApprovedOutreach/sendEmail)',
);

// ── 14. Hardening guards ──

// agencyType from the client is validated against the known enum (invalid ->
// 'unknown') instead of being cast blindly.
const runRouteSrc = read('app/api/owner/discovery/run/route.ts');
assert(
  /VALID_AGENCY_TYPES/.test(runRouteSrc) &&
    /toAgencyType\(/.test(runRouteSrc) &&
    !/body\.agencyType as AgencyType/.test(runRouteSrc),
  'discovery/run validates agencyType against the AgencyType enum (falls back to unknown)',
);

// fetchAgencySignals reuses the discovery isRejectedWebsite() guard before any
// network fetch so it never hits example/localhost/test hosts.
const detectSrc = read('lib/owner/agency/agencyDetect.ts');
assert(
  /import\s*\{\s*isRejectedWebsite\s*\}/.test(detectSrc) &&
    /if\s*\(isRejectedWebsite\(url\)\)/.test(detectSrc),
  'fetchAgencySignals applies the isRejectedWebsite() guard before fetching',
);

// Additive DB CHECK keeps agency_opportunity_score within 0-100 (defense in depth).
const hasScoreCheck = migrations
  .map((f) => read(join(migDir, f)))
  .some((sql) => /owner_prospects_agency_opportunity_score_check/.test(sql));
assert(hasScoreCheck, 'DB CHECK constraint bounds agency_opportunity_score to 0-100');

// ── Optional live DB scan ──
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

async function liveScan(): Promise<void> {
  if (!supabaseUrl || !serviceKey) {
    console.log(
      '\nNOTE: Supabase service credentials not present — skipped live agency-prospect scan.\n' +
        '      Run with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to scan stored agency prospects.',
    );
    return;
  }
  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await admin
    .from('owner_prospects')
    .select('id, business_name, prospect_kind, agency_label, agency_opportunity_score')
    .eq('prospect_kind', 'agency')
    .is('deleted_at', null)
    .limit(200);
  if (error) {
    problems.push(`live agency scan failed: ${error.message}`);
    return;
  }
  const rows = data ?? [];
  console.log(`\nLive scan: ${rows.length} agency prospect(s) in database.`);
  for (const r of rows) {
    if (!r.agency_label) {
      problems.push(`agency prospect "${r.business_name ?? r.id}" missing agency_label`);
    }
  }
}

liveScan()
  .then(() => {
    if (problems.length > 0) {
      console.error('\nFAIL: agency prospect system issues found:');
      for (const p of problems) console.error(`  - ${p}`);
      process.exit(1);
    }
    console.log('\nAll agency prospect system checks passed.');
  })
  .catch((err) => {
    console.error('\nFAIL: verification crashed:', err);
    process.exit(1);
  });
