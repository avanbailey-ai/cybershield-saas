/**
 * SEO readiness verification.
 * Run: npx tsx scripts/verify-seo-readiness.ts
 */

import fs from 'fs';
import path from 'path';
import { FEATURE_PAGES } from '../lib/seo/features';

const root = path.resolve(__dirname, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function exists(rel: string): boolean {
  return fs.existsSync(path.join(root, rel));
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`OK: ${msg}`);
}

function main() {
  assert(exists('app/robots.ts'), 'robots.ts exists');
  assert(exists('app/sitemap.ts'), 'sitemap.ts exists');
  assert(exists('app/icon.svg'), 'favicon/icon exists');
  assert(exists('app/icon.png'), 'PNG icon exists');
  assert(exists('app/favicon.ico'), 'favicon.ico exists');
  assert(exists('app/manifest.ts'), 'web manifest exists');

  const robots = read('app/robots.ts');
  const sitemap = read('app/sitemap.ts');
  const layout = read('app/layout.tsx');
  const metadata = read('lib/seo/metadata.ts');
  const structured = read('lib/seo/structured-data.ts');
  const homepage = read('app/page.tsx');
  const hero = read('components/landing/Hero.tsx');

  assert(robots.includes('sitemap'), 'robots references sitemap');
  assert(sitemap.includes('resolveSiteUrl'), 'sitemap uses canonical site URL');
  assert(FEATURE_PAGES.length >= 8, 'feature pages defined');
  assert(sitemap.includes('/features/'), 'sitemap includes feature pages');

  assert(metadata.includes('alternates'), 'canonical metadata helper exists');
  assert(metadata.includes('icons:'), 'root metadata declares favicon icons');
  assert(metadata.includes('/favicon.ico'), 'favicon.ico referenced in metadata');
  assert(metadata.includes('/icon.png'), 'icon.png referenced in metadata');
  assert(metadata.includes('openGraph'), 'Open Graph in metadata helper');
  assert(metadata.includes('twitter'), 'Twitter cards in metadata helper');
  assert(layout.includes('JsonLd'), 'structured data on root layout');
  assert(structured.includes('Organization'), 'Organization schema');
  assert(structured.includes('SoftwareApplication'), 'SoftwareApplication schema');
  assert(structured.includes('FAQPage'), 'FAQ schema helper');

  assert(homepage.includes('faqSchema'), 'homepage FAQ structured data');
  assert(!homepage.includes('noindex'), 'homepage not noindex');
  assert(hero.includes('Website Security Monitoring'), 'homepage H1 targets primary intent');

  for (const slug of [
    'website-security-monitoring',
    'ssl-monitoring',
    'website-change-detection',
  ]) {
    assert(exists(`app/features/[slug]/page.tsx`), 'dynamic feature route exists');
    assert(
      FEATURE_PAGES.some((f) => f.slug === slug),
      `feature slug ${slug} defined`,
    );
  }

  for (const page of ['about', 'contact', 'security', 'responsible-disclosure', 'privacy', 'terms']) {
    assert(exists(`app/${page}/page.tsx`), `trust/public page /${page}`);
  }

  assert(exists('docs/search-console-setup.md'), 'Search Console setup doc');
  assert(exists('docs/content-strategy.md'), 'content strategy doc');
  assert(exists('docs/SEO-AUDIT-REPORT.md'), 'SEO audit report');

  const footer = read('components/landing/Footer.tsx');
  assert(footer.includes('/features'), 'footer links to features');
  assert(footer.includes('/pricing'), 'footer links to pricing');

  console.log('\nAll SEO readiness checks passed.');
}

main();
