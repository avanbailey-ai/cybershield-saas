/**
 * Free intelligence layer verification — no paid OpenAI/API tokens required.
 *
 * Run: npx tsx scripts/verify-free-intelligence-layer.ts
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  getFindingExplainer,
  listAllExplainers,
  matchExplainerFromText,
  REQUIRED_EXPLAINER_IDS,
} from '../lib/intelligence/catalog';
import { rankFixThisFirst, rankFixThisFirstFromFindings } from '../lib/intelligence/prioritization';
import { generateCustomerReport, formatCustomerReportPlainText } from '../lib/intelligence/customerReport';
import { generateAgencyClientReport, formatAgencyReportPlainText } from '../lib/intelligence/agencyReport';
import { buildFounderRecommendations } from '../lib/intelligence/founderRecommendations';
import {
  BANNED_INTELLIGENCE_PHRASES,
  containsBannedLanguage,
} from '../lib/intelligence/bannedLanguage';
import { getLocalAiConfig, improveDraftWithLocalAi, isLocalAiEnabled } from '../lib/intelligence/localAi';
import { translateFinding, generateOutreach } from '../lib/owner/generators/outreach';
import type { SecurityFinding } from '../lib/securityIntelligence/types';

function read(rel: string): string {
  const p = join(process.cwd(), rel);
  if (!existsSync(p)) return '';
  return readFileSync(p, 'utf8');
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`OK: ${msg}`);
}

const sampleFinding: SecurityFinding = {
  id: 'csp_missing',
  title: 'Missing Content-Security-Policy',
  description: 'CSP header not set',
  severity: 'high',
  category: 'headers',
  impact: ['Reduces XSS protection'],
  exploitScenario: 'Scripts may load from untrusted origins',
  fix: 'Add Content-Security-Policy header',
  securityImpactIfFixed: 'Reduces cross-site scripting risk',
};

async function main() {
  console.log('CyberShield free intelligence layer verification\n');

  // ── Module presence ──
  const modules = [
    'lib/intelligence/types.ts',
    'lib/intelligence/bannedLanguage.ts',
    'lib/intelligence/catalog.ts',
    'lib/intelligence/prioritization.ts',
    'lib/intelligence/customerReport.ts',
    'lib/intelligence/agencyReport.ts',
    'lib/intelligence/founderRecommendations.ts',
    'lib/intelligence/outreachCopy.ts',
    'lib/intelligence/localAi.ts',
    'lib/intelligence/index.ts',
    'components/intelligence/FindingIntelligencePanel.tsx',
    'components/intelligence/CustomerReportPanel.tsx',
    'components/intelligence/AgencyClientReportPanel.tsx',
    'app/api/owner/local-ai/improve-draft/route.ts',
    'scripts/verify-free-intelligence-layer.ts',
  ];

  for (const mod of modules) {
    assert(existsSync(join(process.cwd(), mod)), `${mod} exists`);
  }

  // ── No OpenAI required for intelligence layer ──
  const intelligenceSources = [
    read('lib/intelligence/catalog.ts'),
    read('lib/intelligence/prioritization.ts'),
    read('lib/intelligence/customerReport.ts'),
    read('lib/intelligence/agencyReport.ts'),
    read('lib/intelligence/founderRecommendations.ts'),
    read('lib/intelligence/outreachCopy.ts'),
    read('lib/intelligence/localAi.ts'),
  ].join('\n');

  assert(!/from ['"]openai['"]/i.test(intelligenceSources), 'intelligence modules do not import OpenAI');
  assert(!/OPENAI_API_KEY/.test(intelligenceSources), 'intelligence modules do not require OPENAI_API_KEY');

  // ── Local AI disabled by default, owner-only route ──
  const savedLocalAi = process.env.LOCAL_AI_ENABLED;
  delete process.env.LOCAL_AI_ENABLED;
  assert(!isLocalAiEnabled(), 'local AI disabled by default');
  if (savedLocalAi !== undefined) process.env.LOCAL_AI_ENABLED = savedLocalAi;

  const localAiRoute = read('app/api/owner/local-ai/improve-draft/route.ts');
  assert(localAiRoute.includes('requireOwner'), 'local AI route is owner-only');
  assert(read('.env.example').includes('LOCAL_AI_ENABLED=false'), '.env.example documents local AI default off');

  const config = getLocalAiConfig();
  assert(config.baseUrl.includes('11434'), 'default local AI base URL is Ollama');
  assert(config.model === 'llama3.1', 'default local AI model is llama3.1');

  // ── Deterministic fallback when local AI disabled ──
  process.env.LOCAL_AI_ENABLED = 'false';
  const fallback = await improveDraftWithLocalAi({ draft: 'Hello test draft' });
  assert(fallback.source === 'deterministic_fallback', 'local AI off uses deterministic fallback');
  assert(fallback.improved.includes('Hello test draft'), 'fallback returns original draft unchanged');
  if (savedLocalAi === undefined) delete process.env.LOCAL_AI_ENABLED;
  else process.env.LOCAL_AI_ENABLED = savedLocalAi;

  // ── Required explainers ──
  for (const id of REQUIRED_EXPLAINER_IDS) {
    const ex = getFindingExplainer(id);
    assert(ex !== null, `explainer exists for ${id}`);
    assert(ex!.plainEnglish.length > 10, `${id} has plainEnglish`);
    assert(ex!.businessImpact.length > 10, `${id} has businessImpact`);
    assert(ex!.developerMessage.length > 10, `${id} has developerMessage`);
    assert(ex!.urgency.length > 0, `${id} has urgency`);
    assert(ex!.difficulty.length > 0, `${id} has difficulty`);
  }

  const headerSamples = [
    '[HIGH] Missing Content-Security-Policy',
    'Missing Strict-Transport-Security (HSTS)',
    'Missing Referrer-Policy header',
    'Missing Permissions-Policy',
    'Missing X-Content-Type-Options',
    'Missing X-Frame-Options',
  ];
  for (const sample of headerSamples) {
    assert(matchExplainerFromText(sample) !== null, `matchExplainerFromText handles "${sample.slice(0, 40)}..."`);
  }

  // ── No banned language in catalog ──
  for (const ex of listAllExplainers()) {
    const blob = [ex.plainEnglish, ex.businessImpact, ex.technicalExplanation, ex.developerMessage].join(' ');
    const hit = containsBannedLanguage(blob);
    assert(hit === null, `catalog ${ex.id} has no banned language (${hit ?? 'ok'})`);
  }

  // ── Fix-this-first engine ──
  const downFirst = rankFixThisFirst({
    findings: [],
    siteReachable: false,
    sslValid: true,
    planLevel: 'pro',
  });
  assert(downFirst.items[0]?.id === 'website_unreachable', 'site down ranks highest');

  const sslFirst = rankFixThisFirst({
    findings: [],
    siteReachable: true,
    sslValid: false,
    planLevel: 'pro',
  });
  assert(sslFirst.items[0]?.id === 'ssl_expired', 'expired SSL ranks high');

  const fromFindings = rankFixThisFirstFromFindings([sampleFinding], { planLevel: 'free' });
  assert(fromFindings.items.length >= 1, 'rankFixThisFirstFromFindings returns items');

  // ── Customer report generator ──
  const customerReport = generateCustomerReport({
    siteLabel: 'Test Site',
    siteUrl: 'https://example.com',
    report: {
      summary: 'Test summary',
      riskLevel: 'medium',
      securityScore: 72,
      attackSurfaceScore: 40,
      attackSurfaceLevel: 'Medium',
      findings: [sampleFinding],
      recommendations: [],
      changeSummary: { posture: 'no_change', scoreDelta: 0, highlights: [] },
    },
    findings: [sampleFinding],
    sslValid: true,
    planLevel: 'free',
  });
  const customerPlain = formatCustomerReportPlainText(customerReport);
  assert(customerReport.executiveSummary.length > 20, 'customer report has executive summary');
  assert(customerReport.fixThisFirst.items.length >= 1, 'customer report has fix-this-first items');
  assert(customerPlain.includes('Fix this first'), 'customer plain text includes fix-this-first');
  assert(!containsBannedLanguage(customerPlain), 'customer report has no banned language');

  // ── Agency report generator ──
  const agencyReport = generateAgencyClientReport({
    clientName: 'Acme Co',
    siteUrl: 'https://acme.example',
    siteLabel: 'Acme Website',
    securityScore: 68,
    findings: [sampleFinding],
    sslValid: true,
    scansThisMonth: 4,
    alertsThisMonth: 2,
  });
  const agencyPlain = formatAgencyReportPlainText(agencyReport);
  assert(agencyReport.clientSummary.length > 20, 'agency report has client summary');
  assert(agencyReport.proofOfWork.length > 0, 'agency report has proof of work');
  assert(agencyPlain.includes('Acme'), 'agency plain text includes client name');

  // ── Founder OS recommendations use real data only ──
  const founderSnap = buildFounderRecommendations({
    inbox: [],
    prospects: [],
    followUpsDue: 0,
    pendingApprovals: 0,
    payingCustomers: 0,
    mrrCents: 0,
    emailOpenRate: null,
    agencyProspectCount: 0,
    smbProspectCount: 0,
  });
  assert(founderSnap.dataMissing.includes('No SMB prospects in pipeline'), 'missing SMB data reported');
  assert(founderSnap.dataMissing.includes('No agency-classified prospects'), 'missing agency data reported');
  assert(founderSnap.bestSmbLead === null, 'no fake SMB lead when empty');
  assert(founderSnap.bestAgencyLead === null, 'no fake agency lead when empty');

  // ── Outreach remains manual approval, no auto-send in intelligence path ──
  const outreachSrc = read('lib/owner/generators/outreach.ts');
  assert(!/autoSend|auto_send|sendImmediately/i.test(outreachSrc), 'outreach generator has no auto-send');
  assert(outreachSrc.includes('translateFindingForOutreach') || outreachSrc.includes('@/lib/intelligence'), 'outreach uses intelligence layer');

  const translated = translateFinding('[HIGH] Missing Content-Security-Policy');
  assert(translated.business.length > 10, 'translateFinding returns business copy');
  assert(!/\[HIGH\]/i.test(translated.business), 'translateFinding strips severity tags');

  const outreach = generateOutreach('cold_email', {
    businessName: 'Test Biz',
    website: 'https://example.com',
    industry: 'Retail',
    city: 'Portland',
    scanScore: 70,
    issues: ['[MEDIUM] Missing Referrer-Policy'],
  });
  assert(outreach.length > 50, 'generateOutreach produces content');
  assert(!containsBannedLanguage(outreach), 'outreach content has no banned intelligence phrases');

  // ── UI wiring markers ──
  assert(read('components/report/SecurityFindingCard.tsx').includes('FindingIntelligencePanel'), 'finding panel wired');
  assert(read('components/report/SecurityReportExperience.tsx').includes('CustomerReportPanel'), 'customer report panel wired');
  assert(read('app/report/[id]/page.tsx').includes('intelligenceReport={intelligence}'), 'report page passes intelligence');
  assert(read('components/enterprise/EnterpriseAgencyDashboard.tsx').includes('AgencyClientReportPanel'), 'agency panel wired');
  assert(read('components/owner/dashboard/FounderCommandCenterHome.tsx').includes('buildFounderRecommendations'), 'founder OS uses recommendations');
  assert(read('components/owner/dashboard/FounderCommandCenterHome.tsx').includes('Why this lead?'), 'founder OS has why-this-lead');
  assert(
    read('components/dashboard/DashboardV4TopRow.tsx').includes('immediateAttentionTitle') ||
      read('components/dashboard/DashboardV4TopRow.tsx').includes('Fix this first'),
    'dashboard has fix-this-first section',
  );

  // ── Banned phrase list completeness ──
  for (const phrase of BANNED_INTELLIGENCE_PHRASES) {
    assert(phrase.length > 5, `banned phrase defined: ${phrase}`);
  }

  console.log('\nAll free intelligence layer checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
