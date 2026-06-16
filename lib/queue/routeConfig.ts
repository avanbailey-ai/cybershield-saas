/**
 * Vercel serverless duration for routes that await scan workers.
 * Must exceed scan timeout + post-process buffer (see getScanJobTimeoutMs).
 */
export const SCAN_ROUTE_MAX_DURATION = 180;
