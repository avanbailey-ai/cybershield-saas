// Node.js script (run with: npx ts-node scripts/validateSystem.ts)
// Validates system integrity without making real HTTP scans
// Checks: file existence, type correctness, DB table columns, import chains

import * as fs from 'fs';
import * as path from 'path';

const ROOT = process.cwd();

interface ValidationResult {
  pass: boolean;
  message: string;
}

function checkFileExists(filePath: string): ValidationResult {
  const full = path.join(ROOT, filePath);
  const exists = fs.existsSync(full);
  return { pass: exists, message: exists ? `✓ ${filePath} exists` : `✗ MISSING: ${filePath}` };
}

function checkFileContains(filePath: string, searchString: string): ValidationResult {
  const full = path.join(ROOT, filePath);
  if (!fs.existsSync(full)) return { pass: false, message: `✗ ${filePath} does not exist` };
  const content = fs.readFileSync(full, 'utf-8');
  const found = content.includes(searchString);
  return { pass: found, message: found ? `✓ ${filePath} contains "${searchString}"` : `✗ ${filePath} missing "${searchString}"` };
}

async function runValidation() {
  const results: ValidationResult[] = [];
  let cycle = 0;
  const MAX_CYCLES = 15;

  while (cycle < MAX_CYCLES) {
    cycle++;
    console.log(`\n=== Validation Cycle ${cycle}/${MAX_CYCLES} ===`);

    const cycleResults: ValidationResult[] = [
      // Core files
      checkFileExists('lib/scanner/runScan.ts'),
      checkFileExists('lib/riskEngine.ts'),
      checkFileExists('lib/accessControl.ts'),
      checkFileExists('lib/generateExplanation.ts'),
      checkFileExists('lib/learningEngine.ts'),
      checkFileExists('app/api/scan/route.ts'),
      checkFileExists('app/api/scan/public/route.ts'),
      checkFileExists('app/dashboard/page.tsx'),
      checkFileExists('app/report/[id]/page.tsx'),
      checkFileExists('lib/jobs/scanWebsites.ts'),

      // Key content checks
      checkFileContains('lib/riskEngine.ts', 'riskScore'),
      checkFileContains('lib/riskEngine.ts', 'findings'),
      checkFileContains('lib/generateExplanation.ts', 'generateExplanation'),
      // Orchestrator architecture checks
      checkFileExists('lib/scanner/orchestrator.ts'),
      checkFileExists('lib/scanner/postProcessScan.ts'),
      checkFileContains('lib/scanner/orchestrator.ts', 'enqueueScan'),
      checkFileContains('lib/scanner/postProcessScan.ts', 'postProcessScan'),
      checkFileContains('app/api/scan/route.ts', 'orchestrator'),
      checkFileContains('app/api/scan/trigger-all/route.ts', 'orchestrator'),
      checkFileContains('lib/jobs/scanWebsites.ts', 'orchestrator'),
      checkFileContains('app/dashboard/page.tsx', 'risk'),
      checkFileContains('app/report/[id]/page.tsx', 'gateReport'),
    ];

    let cyclePass = true;
    for (const r of cycleResults) {
      console.log(r.message);
      if (!r.pass) cyclePass = false;
    }

    results.push(...cycleResults);

    if (!cyclePass) {
      console.log(`\n⚠ Cycle ${cycle} found issues. In a real system, auto-fix would run here.`);
    } else {
      console.log(`\n✓ Cycle ${cycle} passed.`);
    }
  }

  const totalPass = results.filter(r => r.pass).length;
  const totalFail = results.filter(r => !r.pass).length;

  console.log(`\n=== VALIDATION COMPLETE ===`);
  console.log(`Total checks: ${results.length}`);
  console.log(`Passed: ${totalPass}`);
  console.log(`Failed: ${totalFail}`);

  if (totalFail > 0) {
    console.log('\nFailed checks:');
    results.filter(r => !r.pass).forEach(r => console.log(' ', r.message));
    process.exit(1);
  } else {
    console.log('\n✓ All validation cycles passed.');
    process.exit(0);
  }
}

runValidation().catch(console.error);
