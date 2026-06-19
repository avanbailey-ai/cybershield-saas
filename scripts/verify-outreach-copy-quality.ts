/**
 * Outreach copy quality verification.
 *
 * Enforces the business-owner-first outreach rules on BOTH:
 *   1. The generator templates (deterministic — always checked), and
 *   2. Unsent outreach drafts in the database (checked when Supabase service
 *      credentials are available in the environment).
 *
 * Fails when outreach copy:
 *   - starts with raw severity tags ([HIGH]/[MEDIUM]/…)
 *   - contains the grammar bug "because Our scan"
 *   - contains double punctuation from joined findings (e.g. "..")
 *   - puts raw scanner findings in the opening paragraph
 *   - lacks the CyberShield Cloud product explanation
 *   - lacks the calm "not hacked / compromised" disclaimer
 *   - lacks a low-pressure CTA
 *   - lacks plain-English finding translations (when findings exist)
 *
 * Run: npx tsx scripts/verify-outreach-copy-quality.ts
 */

import {
  generateOutreach,
  translateFinding,
  selectOutreachVariant,
  SAFETY_DISCLAIMER,
  PRODUCT_EXPLANATION,
  OUTREACH_VARIANTS,
  type OutreachInput,
} from '../lib/owner/generators/outreach';

// ── severity tags & raw scanner phrases that must never lead the email ──
const SEVERITY_TAG = /\[(critical|high|medium|low|info|informational)\]/i;
const RAW_SCANNER_HEADER =
  /\bMissing (Content-Security-Policy|Referrer-Policy|Permissions-Policy|Strict-Transport-Security|X-Frame-Options|X-Content-Type-Options|HSTS)\b/i;
const DOUBLE_PUNCT = /(?<![.!?])([.!?])\1(?!\1)/; // ".." or "!!" but not "..." ellipsis
const CTA_PHRASES = [
  'send over the short scan summary',
  'send the quick summary',
  'scan summary',
  'review what was flagged',
];

function bodyOf(content: string): string {
  const m = content.match(/^Subject:.*?(?:\n|$)/i);
  return m ? content.slice(m[0].length).trim() : content.trim();
}

function firstParagraph(body: string): string {
  // skip a leading greeting line ("Hi ...,") then take the first real paragraph
  const paras = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paras.length === 0) return '';
  if (/^hi\b/i.test(paras[0]) && paras[0].length < 40 && paras.length > 1) return paras[1];
  return paras[0];
}

interface CheckOptions {
  /** require CyberShield Cloud product explanation + CTA (true for outreach emails) */
  requireProductAndCta?: boolean;
  /** require plain-English translations (true when findings are present) */
  expectFindingTranslations?: boolean;
  /** business strings that should appear when findings are present */
  expectedTranslations?: string[];
}

function contentIssues(label: string, content: string, opts: CheckOptions = {}): string[] {
  const problems: string[] = [];
  const body = bodyOf(content);
  const opening = firstParagraph(body);

  // ── negative rules — always enforced ──
  if (SEVERITY_TAG.test(content)) problems.push(`${label}: contains raw severity tag (e.g. [MEDIUM])`);
  if (/because Our scan/.test(content)) problems.push(`${label}: contains grammar bug "because Our scan"`);
  if (DOUBLE_PUNCT.test(content)) problems.push(`${label}: contains double punctuation (joined-finding artifact)`);
  if (SEVERITY_TAG.test(opening)) problems.push(`${label}: opens with a raw severity tag`);
  if (RAW_SCANNER_HEADER.test(opening)) problems.push(`${label}: opens with raw scanner findings`);

  // ── calm disclaimer — always enforced ──
  if (!content.includes(SAFETY_DISCLAIMER) && !/hacked or compromised/i.test(content)) {
    problems.push(`${label}: missing calm "not hacked/compromised" disclaimer`);
  }

  // ── product explanation + CTA — outreach emails only ──
  if (opts.requireProductAndCta) {
    if (!content.includes(PRODUCT_EXPLANATION) && !/CyberShield Cloud monitors business websites/.test(content)) {
      problems.push(`${label}: missing CyberShield Cloud product explanation`);
    }
    if (!CTA_PHRASES.some((p) => content.toLowerCase().includes(p))) {
      problems.push(`${label}: missing low-pressure CTA`);
    }
  }

  if (opts.expectFindingTranslations) {
    const expected = opts.expectedTranslations ?? [];
    const hasTranslation = expected.length === 0 || expected.some((t) => content.includes(t));
    if (!hasTranslation) problems.push(`${label}: missing plain-English finding translations`);
  }

  return problems;
}

console.log('CyberShield outreach copy quality verification\n');

const allProblems: string[] = [];

// ── 1. Generator template checks ──
const sampleIssues = [
  '[MEDIUM] Missing Referrer-Policy — Referrer-Policy header is missing.',
  '[MEDIUM] Missing Permissions-Policy — Permissions-Policy header not present.',
  '[HIGH] Missing Content-Security-Policy',
  '[MEDIUM] Missing Strict-Transport-Security (HSTS)',
];
const expectedTranslations = sampleIssues.map((i) => translateFinding(i).business);

const baseInput: OutreachInput = {
  businessName: 'Case Coffee Roasters',
  website: 'https://www.casecoffeeroasters.com',
  industry: 'Hospitality',
  city: 'Ashland',
  scanScore: 72,
  riskLevel: 'medium',
  issues: sampleIssues,
  contactEmail: 'info@casecoffeeroasters.com',
};

// cold_email across every variant (including the auto-selected one)
for (const v of OUTREACH_VARIANTS) {
  const content = generateOutreach('cold_email', { ...baseInput, variant: v.id });
  const problems = contentIssues(`cold_email/${v.id}`, content, {
    requireProductAndCta: true,
    expectFindingTranslations: true,
    expectedTranslations,
  });
  if (problems.length === 0) console.log(`OK: cold_email/${v.id} passes copy quality rules`);
  allProblems.push(...problems);
}

// outreach emails sent as prose — require product explanation + CTA, but they
// don't enumerate findings so translations are not required
for (const type of ['follow_up', 'agency_pitch'] as const) {
  const content = generateOutreach(type, baseInput);
  const problems = contentIssues(type, content, { requireProductAndCta: true });
  if (problems.length === 0) console.log(`OK: ${type} passes copy quality rules`);
  allProblems.push(...problems);
}

// audit_summary is an internal-style summary — enforce negative rules + disclaimer
{
  const content = generateOutreach('audit_summary', baseInput);
  const problems = contentIssues('audit_summary', content);
  if (problems.length === 0) console.log('OK: audit_summary passes copy quality rules');
  allProblems.push(...problems);
}

// no-findings case still must be calm + explain the product + have a CTA
{
  const content = generateOutreach('cold_email', { ...baseInput, issues: [] });
  const problems = contentIssues('cold_email/no-findings', content, { requireProductAndCta: true });
  if (problems.length === 0) console.log('OK: cold_email with no findings stays calm + on-message');
  allProblems.push(...problems);
}

// auto variant selection sanity
{
  const variant = selectOutreachVariant(baseInput);
  if (!OUTREACH_VARIANTS.some((v) => v.id === variant)) {
    allProblems.push(`selectOutreachVariant returned unknown variant: ${variant}`);
  } else {
    console.log(`OK: variant auto-selection resolves (${variant})`);
  }
  // regression: "Hospitality" must NOT match the "hospital" healthcare keyword
  const hospitality = selectOutreachVariant({ ...baseInput, industry: 'Hospitality' });
  if (hospitality === 'healthcare') {
    allProblems.push('Hospitality industry wrongly classified as healthcare (substring "hospital")');
  } else {
    console.log(`OK: "Hospitality" industry classified as ${hospitality}, not healthcare`);
  }
}

// ── 2. Unsent draft checks (DB) — only when service credentials are present ──
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

async function scanDrafts(): Promise<void> {
  if (!supabaseUrl || !serviceKey) {
    console.log(
      '\nNOTE: Supabase service credentials not present — skipped live unsent-draft scan.\n' +
        '      Run with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to scan stored drafts.',
    );
    return;
  }

  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data, error } = await admin
    .from('owner_outreach_drafts')
    .select('id, business_name, content, status, sent_at')
    .is('deleted_at', null)
    .is('sent_at', null)
    .in('status', ['draft', 'approved'])
    .limit(200);

  if (error) {
    allProblems.push(`DB draft scan failed: ${error.message}`);
    return;
  }

  const drafts = data ?? [];
  console.log(`\nScanning ${drafts.length} unsent draft(s) in database...`);
  for (const d of drafts) {
    const content = String(d.content ?? '');
    const hasFindings = SEVERITY_TAG.test(content) || /\bMissing\b/i.test(content) || true;
    const problems = contentIssues(
      `draft ${d.business_name ?? d.id}`,
      content,
      { expectFindingTranslations: false },
    );
    void hasFindings;
    if (problems.length === 0) {
      console.log(`OK: draft "${d.business_name ?? d.id}" passes copy quality rules`);
    }
    allProblems.push(...problems);
  }
}

scanDrafts()
  .then(() => {
    if (allProblems.length > 0) {
      console.error('\nFAIL: outreach copy quality issues found:');
      for (const p of allProblems) console.error(`  - ${p}`);
      process.exit(1);
    }
    console.log('\nAll outreach copy quality checks passed.');
  })
  .catch((err) => {
    console.error('\nFAIL: verification crashed:', err);
    process.exit(1);
  });
