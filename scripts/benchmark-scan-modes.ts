/**
 * Compare lightweight vs deep scan duration against a URL.
 * Run: npx tsx scripts/benchmark-scan-modes.ts [url]
 */

import { executeScanWithTimeout } from '../lib/scanner/executeScanWithTimeout';

const url = process.argv[2] ?? 'https://example.com';

async function bench(kind: 'monitoring_check' | 'deep_scan') {
  const start = Date.now();
  const result = await executeScanWithTimeout(url, kind);
  const ms = Date.now() - start;
  return { kind, ms, score: result.score, issues: result.issues.length, error: result.error };
}

async function main() {
  console.log(`Benchmarking scan modes for ${url}\n`);

  const lightweight = await bench('monitoring_check');
  const deep = await bench('deep_scan');

  console.table([lightweight, deep]);

  const savings =
    deep.ms > 0 ? `${Math.round((1 - lightweight.ms / deep.ms) * 100)}% faster` : 'n/a';
  console.log(`\nLightweight vs deep: ${savings} (${lightweight.ms}ms vs ${deep.ms}ms)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
