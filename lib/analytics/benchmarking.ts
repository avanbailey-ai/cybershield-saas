import type { SupabaseClient } from '@supabase/supabase-js';

export type WebsiteCategory = 'ecommerce' | 'saas' | 'portfolio' | 'blog';

export interface CategoryBenchmarkStats {
  /** MOCK — global average security score for this category (0–100). */
  average: number;
  /** MOCK — score at each decile (10th … 100th percentile) for percentile interpolation. */
  deciles: [number, number, number, number, number, number, number, number, number, number, number];
}

/**
 * MOCK DATA — hardcoded category benchmarks until real cross-tenant aggregates exist.
 * Replace `MOCK_CATEGORY_BENCHMARKS` with DB-backed aggregates when available.
 */
export const MOCK_CATEGORY_BENCHMARKS: Record<WebsiteCategory, CategoryBenchmarkStats> = {
  ecommerce: {
    average: 58,
    deciles: [22, 32, 40, 46, 52, 58, 64, 70, 78, 86, 94],
  },
  saas: {
    average: 68,
    deciles: [32, 42, 50, 56, 62, 68, 74, 80, 86, 92, 98],
  },
  portfolio: {
    average: 72,
    deciles: [38, 48, 56, 62, 68, 72, 76, 82, 88, 93, 99],
  },
  blog: {
    average: 64,
    deciles: [28, 38, 46, 52, 58, 64, 70, 76, 83, 90, 97],
  },
};

const PERCENTILE_STEPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;

const CATEGORY_LABELS: Record<WebsiteCategory, string> = {
  ecommerce: 'ecommerce',
  saas: 'SaaS',
  portfolio: 'portfolio',
  blog: 'blog',
};

export interface SecurityBenchmarkResult {
  category: WebsiteCategory;
  score: number;
  globalAverage: number;
  percentile: number;
  statement: string;
}

export function normalizeWebsiteCategory(value: string | null | undefined): WebsiteCategory | null {
  if (!value) return null;
  const key = value.trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (key === 'ecommerce' || key === 'ecom') return 'ecommerce';
  if (key === 'saas') return 'saas';
  if (key === 'portfolio') return 'portfolio';
  if (key === 'blog') return 'blog';
  return null;
}

/** Minimal URL heuristics when category is not stored on the website row. */
export function inferCategoryFromUrl(url: string): WebsiteCategory {
  const lower = url.toLowerCase();

  if (/shop|store|cart|checkout|buy|product|woocommerce|shopify/.test(lower)) {
    return 'ecommerce';
  }
  if (/blog|news|article|post|wordpress|medium\.com|substack/.test(lower)) {
    return 'blog';
  }
  if (/portfolio|behance|dribbble|cv|resume|personal/.test(lower)) {
    return 'portfolio';
  }
  if (/app\.|dashboard|api\.|saas|platform|cloud/.test(lower)) {
    return 'saas';
  }

  return 'saas';
}

export function resolveWebsiteCategory(
  explicitCategory: string | null | undefined,
  websiteUrl?: string | null,
): WebsiteCategory {
  const normalized = normalizeWebsiteCategory(explicitCategory);
  if (normalized) return normalized;
  if (websiteUrl) return inferCategoryFromUrl(websiteUrl);
  return 'saas';
}

/**
 * Percentile ranking vs MOCK category distribution (0–100).
 * Higher score → higher percentile (more secure than peers).
 */
export function calculatePercentile(score: number, category: WebsiteCategory): number {
  const { deciles } = MOCK_CATEGORY_BENCHMARKS[category];
  const curve = [Math.max(0, deciles[0] - 10), ...deciles];

  if (score <= curve[0]) return 0;
  if (score >= curve[curve.length - 1]) return 100;

  for (let i = 1; i < curve.length; i++) {
    if (score <= curve[i]) {
      const p0 = PERCENTILE_STEPS[i - 1];
      const p1 = PERCENTILE_STEPS[i];
      const s0 = curve[i - 1];
      const s1 = curve[i];
      const t = s1 === s0 ? 0 : (score - s0) / (s1 - s0);
      return Math.round(p0 + t * (p1 - p0));
    }
  }

  return 100;
}

function buildStatement(category: WebsiteCategory, percentile: number): string {
  const label = CATEGORY_LABELS[category];
  return `Your website is more secure than ${percentile}% of ${label} sites`;
}

export async function getBenchmarkForWebsite(
  supabase: SupabaseClient,
  websiteId: string,
  options?: { category?: string | null; websiteUrl?: string | null },
): Promise<SecurityBenchmarkResult> {
  const category = resolveWebsiteCategory(options?.category, options?.websiteUrl);

  const { data: scan, error } = await supabase
    .from('scans')
    .select('security_score')
    .eq('website_id', websiteId)
    .eq('status', 'completed')
    .not('security_score', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!scan || scan.security_score === null) {
    throw new Error('No completed scan with security score found for this website');
  }

  const score = scan.security_score;
  const globalAverage = MOCK_CATEGORY_BENCHMARKS[category].average;
  const percentile = calculatePercentile(score, category);

  return {
    category,
    score,
    globalAverage,
    percentile,
    statement: buildStatement(category, percentile),
  };
}
