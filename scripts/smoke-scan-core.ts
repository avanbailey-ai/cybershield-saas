import { runScan } from '../lib/scanner/runScan';

async function main() {
  const result = await runScan('https://example.com');

  if (typeof result.score !== 'number') {
    throw new Error('Invalid score');
  }
  if (!Array.isArray(result.issues)) {
    throw new Error('Invalid issues');
  }
  if (!result.riskLevel) {
    throw new Error('Missing riskLevel');
  }

  console.log('SMOKE_OK', { score: result.score, riskLevel: result.riskLevel });
}

main().catch((e) => {
  console.error('SMOKE_FAIL', e);
  process.exit(1);
});
