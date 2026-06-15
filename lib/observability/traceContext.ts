/**
 * Trace propagation — AsyncLocalStorage for server routes + header pass-through.
 */

import { AsyncLocalStorage } from 'async_hooks';

import { generateTraceId } from './index';

const traceStore = new AsyncLocalStorage<string>();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Read trace id from AsyncLocalStorage (if inside withTrace). */
export function getTraceId(): string | undefined {
  return traceStore.getStore();
}

/** Run fn with trace id bound in AsyncLocalStorage. */
export function withTrace<T>(traceId: string, fn: () => T): T {
  return traceStore.run(traceId, fn);
}

/** Accept X-Trace-Id header value or generate a new trace id. */
export function resolveTraceId(headerValue?: string | null): string {
  const trimmed = headerValue?.trim();
  if (trimmed && isValidUuid(trimmed)) return trimmed;
  return generateTraceId();
}

/** Resolve trace from request header, falling back to ALS or new id. */
export function resolveRequestTraceId(headerValue?: string | null): string {
  return getTraceId() ?? resolveTraceId(headerValue);
}
