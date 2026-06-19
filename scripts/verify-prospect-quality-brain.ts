/**
 * Prospect Quality Brain verification — SMB + agency generators, pipeline gates, contact confidence.
 *
 * Run: npx tsx scripts/verify-prospect-quality-brain.ts
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  assessProspectQuality,
  canCreateOutreachDraft,
  classifyContactConfidence,
  evaluateDiscoveryRejection,
  formatDiscoverySummary,
  emptyDiscoveryBreakdown,
  isOutreachReadyContact,
  isPlaceholderEmail,
  isSensitiveSector,
  OUTREACH_READY_CONTACT,
  rejectionReasonLabel,
} from '../lib/owner/prospectQualityBrain';
import { decideProspectKind, scoreAgency } from '../lib/owner/agency/agencyScore';
import { detectAgencySignalsFromHtml } from '../lib/owner/agency/agencyDetect';
import { parseContactSignalsFromHtml } from '../lib/owner/contactDiscovery';
import { isPlaceholderPhone, sanitizePhone } from '../lib/owner/placeholderPhone';

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

console.log('CyberShield prospect quality brain verification\n');

// ── Module exists ──
assert(existsSync(join(process.cwd(), 'lib/owner/prospectQualityBrain.ts')), 'prospectQualityBrain module exists');
assert(
  existsSync(join(process.cwd(), 'supabase/migrations/20260620120000_prospect_quality_brain.sql')),
  'Quality brain migration exists',
);

// ── SMB vs agency scoring separate ──
const brainSrc = read('lib/owner/prospectQualityBrain.ts');
const agencySrc = read('lib/owner/agency/agencyScore.ts');
assert(!/computeAgencyOpportunityScore/.test(brainSrc), 'Quality brain does not duplicate agency score function');
assert(/assessProspectQuality/.test(brainSrc), 'assessProspectQuality central gate exists');
assert(!/salesIntelligence[^\n]*computeOpportunityScore/.test(agencySrc), 'Agency scoring separate from SMB');

// ── Normal SMB not labeled agency ──
const smbAssessment = assessProspectQuality({
  businessName: 'Case Coffee Roasters',
  website: 'https://casecoffeeroasters.com',
  industry: 'coffee',
  prospectKind: 'smb',
  scanStatus: 'completed',
  scanCompleted: true,
  leadScore: 'WARM',
  opportunityScore: 55,
  signals: {
    contact_page_found: true,
    contact_email_found: true,
    contact_phone_found: false,
    contact_linkedin_found: false,
    contact_email: 'hello@casecoffeeroasters.com',
    contact_phone: null,
    contact_linkedin: null,
    contact_confidence: 'generic_public_inbox',
  },
  httpValid: true,
  dnsValid: true,
  scanIssues: ['Missing Strict-Transport-Security header'],
  planFit: 79,
});
assert(smbAssessment.qualityLabel === 'HOT' || smbAssessment.qualityLabel === 'WARM', 'Case Coffee SMB scores HOT/WARM');
assert(smbAssessment.outreachReady === true, 'Case Coffee SMB can reach outreach-ready with verified contact + scan');

// ── NOT AGENCY FIT stays out of agency pipeline ──
const blogSignals = detectAgencySignalsFromHtml('<html><body>My personal photography blog</body></html>');
const blogScore = scoreAgency({
  businessName: 'Jane Photos',
  website: 'https://janephotos.example',
  signals: blogSignals,
  hasContactEmail: false,
});
assert(blogScore.label === 'NOT AGENCY FIT', 'Photographer blog labeled NOT AGENCY FIT');
assert(decideProspectKind({ ...blogScore, signals: blogSignals }) === 'smb', 'NOT AGENCY FIT stays SMB segment');

// ── Agency requires evidence ──
const agencyHtml = `
  <html><body>
  <h1>WordPress agency — we manage client websites</h1>
  <p>Website care plans, hosting, and maintenance for 30+ clients.</p>
  <a href="/portfolio">Portfolio</a>
  <a href="mailto:hello@roguevalleyweb.com">Contact</a>
  </body></html>`;
const agencySignals = detectAgencySignalsFromHtml(agencyHtml);
const agencyResult = scoreAgency({
  businessName: 'Rogue Valley Web',
  website: 'https://roguevalleyweb.com',
  signals: agencySignals,
  hasContactEmail: true,
});
assert(agencySignals.managesClientSites === true, 'Agency detection requires client-site evidence');
assert(isAgencyFitLabel(agencyResult.label), 'Real agency scores as agency fit');
assert(decideProspectKind({ ...agencyResult, signals: agencySignals }) === 'agency', 'Strong agency enters agency pipeline');

function isAgencyFitLabel(label: string): boolean {
  return label !== 'NOT AGENCY FIT';
}

// ── Contact confidence ──
assert(
  classifyContactConfidence('info@acmelaw.com', 'https://acmelaw.com') === 'generic_public_inbox',
  'Same-domain generic inbox classified correctly',
);
assert(
  classifyContactConfidence('john@gmail.com', 'https://acmelaw.com', { fromPublicPage: true }) ===
    'personal_public_contact',
  'Published Gmail classified as personal public contact',
);
assert(
  classifyContactConfidence('guess@acmelaw.com', 'https://acmelaw.com', { guessed: true }) === 'unverified_guess',
  'Guessed emails marked unverified',
);
assert(isPlaceholderEmail('test@acme.com'), 'Placeholder test@ rejected');
assert(
  !isOutreachReadyContact('unverified_guess'),
  'Unverified guess cannot be outreach-ready contact',
);
assert(OUTREACH_READY_CONTACT.length === 3, 'Three contact tiers qualify for outreach');

// ── Rejection reasons stored ──
const reject = evaluateDiscoveryRejection({
  businessName: 'City Hall',
  website: 'https://medford.gov',
  industry: 'government',
  httpValid: true,
  dnsValid: true,
});
assert(reject.reject === true && reject.reason === 'public_institution', 'Government rejected with reason');
assert(
  rejectionReasonLabel('not_agency_fit') === 'Not agency fit',
  'Rejection reason labels human-readable',
);

// ── Discovery breakdown ──
const breakdown = emptyDiscoveryBreakdown();
breakdown.rawResults = 47;
breakdown.duplicatesSkipped = 18;
breakdown.rejectedLowFit = 12;
breakdown.missingContact = 7;
breakdown.qualified = 6;
breakdown.outreachReady = 4;
const summary = formatDiscoverySummary(breakdown, 22);
assert(summary.includes('47 raw results'), 'Discovery summary shows raw results');
assert(summary.includes('18 duplicates skipped'), 'Discovery summary shows duplicates');
assert(summary.includes('12 rejected low-fit'), 'Discovery summary shows rejections');

// ── Outreach-ready gates ──
assert(
  canCreateOutreachDraft({
    pipeline_state: 'outreach_ready',
    scan_status: 'completed',
    quality_label: 'HOT',
    contact_confidence: 'verified_public_email',
    contact_email: 'info@test.com',
  }),
  'Stage 5: HOT + verified contact + outreach_ready allows draft creation check',
);
assert(
  !canCreateOutreachDraft({
    pipeline_state: 'qualified',
    scan_status: 'completed',
    quality_label: 'WARM',
    contact_confidence: 'verified_public_email',
    contact_email: 'info@test.com',
  }),
  'Qualified-only prospects cannot pass draft gate',
);
assert(
  !canCreateOutreachDraft({
    pipeline_state: 'outreach_ready',
    scan_status: 'completed',
    quality_label: 'WARM',
    contact_confidence: 'unverified_guess',
    contact_email: 'guess@test.com',
  }),
  'Unverified email blocked from outreach-ready draft gate',
);

// ── Sensitive sector manual review ──
assert(isPlaceholderPhone('0000000000'), '0000000000 treated as placeholder phone');
assert(isPlaceholderPhone('1111111111'), '1111111111 treated as placeholder phone');
assert(isPlaceholderPhone('1234567890'), '1234567890 treated as placeholder phone');
assert(sanitizePhone('0000000000') === null, 'Placeholder phone sanitized to null');
assert(sanitizePhone('(541) 555-0199') === '(541) 555-0199', 'Real phone preserved');
assert(isSensitiveSector('dental', 'Smile Dental'), 'Dental flagged sensitive');
const dental = assessProspectQuality({
  businessName: 'Smile Dental',
  website: 'https://smiledental.com',
  industry: 'dental',
  prospectKind: 'smb',
  scanStatus: 'completed',
  scanCompleted: true,
  opportunityScore: 50,
  signals: {
    contact_page_found: true,
    contact_email_found: true,
    contact_phone_found: false,
    contact_linkedin_found: false,
    contact_email: 'info@smiledental.com',
    contact_phone: null,
    contact_linkedin: null,
    contact_confidence: 'generic_public_inbox',
  },
  httpValid: true,
  dnsValid: true,
  planFit: 79,
  rejectionReason: 'sensitive_sector_manual_review',
});
assert(dental.qualityLabel === 'NEEDS REVIEW', 'Sensitive sector requires manual review label');
assert(dental.pipelineState === 'needs_review', 'Sensitive sector pipeline state needs_review');

// ── No fake contacts / no auto-send ──
const ensureSrc = read('lib/owner/ensureOutreachDraft.ts');
assert(!/resend|sendEmail|auto.?send/i.test(ensureSrc), 'ensureOutreachDraft does not send email');
assert(/canCreateOutreachDraft/.test(ensureSrc), 'Draft creation uses quality gate');
const engineSrc = read('lib/owner/discovery/engine.ts');
assert(!/sendOutreach|approveOutreach|autoSend/i.test(engineSrc), 'Discovery engine has no auto-send path');

// ── Suppression hook exists ──
const deliverSrc = read('lib/owner/deliverabilityGuard.ts');
assert(/isEmailSuppressed/.test(deliverSrc), 'Deliverability guard blocks suppressed/unsubscribed emails');

// ── Prospect card scorecard fields ──
const cardSrc = read('components/owner/ProspectCard.tsx');
assert(/quality_label/.test(cardSrc) && /contact_confidence/.test(cardSrc), 'Prospect cards show quality scorecard');
assert(/buying_trigger/.test(cardSrc) && /rejection_reason/.test(cardSrc), 'Prospect cards show why/rejection');

// ── Filters ──
const filterSrc = read('lib/owner/prospectFilters.ts');
assert(/'hot'/.test(filterSrc) && /'rejected'/.test(filterSrc), 'Quality filters HOT/REJECTED exist');

// ── Contact parse rejects placeholders ──
const parsed = parseContactSignalsFromHtml(
  '<a href="mailto:test@example.com">Email</a><a href="mailto:info@realbiz.com">Real</a>',
  'https://realbiz.com',
);
assert(parsed.contact_email === 'info@realbiz.com', 'Contact parser prefers real email over placeholder');

// ── Rejected bad prospect example ──
const bad = assessProspectQuality({
  businessName: 'Yellow Pages Listing',
  website: 'https://yellowpages.com/listing/foo',
  industry: 'directory',
  prospectKind: 'smb',
  scanStatus: 'pending',
  scanCompleted: false,
  opportunityScore: 5,
  signals: {
    contact_page_found: false,
    contact_email_found: false,
    contact_phone_found: false,
    contact_linkedin_found: false,
    contact_email: null,
    contact_phone: null,
    contact_linkedin: null,
    contact_confidence: 'no_contact',
  },
  rejectionReason: 'directory_result',
});
assert(bad.qualityLabel === 'REJECTED', 'Directory listing rejected');

console.log('\n--- Examples ---');
console.log('Accepted SMB:', smbAssessment.whySelected);
console.log('Accepted agency:', agencyResult.whySelected);
console.log('Rejected:', bad.rejectionReason, '—', rejectionReasonLabel(bad.rejectionReason));

console.log('\n--- Result ---');
if (problems.length) {
  console.error(`FAILED (${problems.length}):`);
  for (const p of problems) console.error(' -', p);
  process.exit(1);
}
console.log('All prospect quality brain checks passed.');
