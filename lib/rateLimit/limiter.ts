/**
 * Lightweight in-memory rate limiter — Redis-ready via pluggable store.
 * Plan-aware limits for scan, checkout, and webhook protection.
 */

import type { Plan } from '@/lib/billing/plans';

interface WindowEntry {
  count: number;
  windowStart: number;
}

const windows = new Map<string, WindowEntry>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const PLAN_SCAN_LIMITS: Record<Plan | 'anonymous', RateLimitConfig> = {
  anonymous: { maxRequests: 5, windowMs: 60_000 },
  free: { maxRequests: 10, windowMs: 60_000 },
  pro: { maxRequests: 30, windowMs: 60_000 },
  growth: { maxRequests: 60, windowMs: 60_000 },
  agency: { maxRequests: 120, windowMs: 60_000 },
  owner: { maxRequests: 500, windowMs: 60_000 },
};

const CHECKOUT_LIMIT: RateLimitConfig = { maxRequests: 5, windowMs: 60_000 };
const WEBHOOK_LIMIT: RateLimitConfig = { maxRequests: 200, windowMs: 60_000 };
const BETA_REPORT_PUBLIC_LIMIT: RateLimitConfig = { maxRequests: 5, windowMs: 15 * 60_000 };
const BETA_REPORT_AUTH_LIMIT: RateLimitConfig = { maxRequests: 20, windowMs: 15 * 60_000 };

function checkLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const entry = windows.get(key);

  if (!entry || now - entry.windowStart >= config.windowMs) {
    windows.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetMs: config.windowMs,
    };
  }

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetMs: config.windowMs - (now - entry.windowStart),
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetMs: config.windowMs - (now - entry.windowStart),
  };
}

export function rateLimitScan(
  identifier: string,
  plan: Plan | 'anonymous' = 'anonymous',
): RateLimitResult {
  const config = PLAN_SCAN_LIMITS[plan] ?? PLAN_SCAN_LIMITS.anonymous;
  return checkLimit(`scan:${identifier}`, config);
}

export function rateLimitCheckout(userId: string): RateLimitResult {
  return checkLimit(`checkout:${userId}`, CHECKOUT_LIMIT);
}

export function rateLimitWebhook(sourceIp: string): RateLimitResult {
  return checkLimit(`webhook:${sourceIp}`, WEBHOOK_LIMIT);
}

export function rateLimitBetaReport(identifier: string, authenticated: boolean): RateLimitResult {
  const config = authenticated ? BETA_REPORT_AUTH_LIMIT : BETA_REPORT_PUBLIC_LIMIT;
  return checkLimit(`beta-report:${identifier}`, config);
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetMs / 1000)),
  };
}
