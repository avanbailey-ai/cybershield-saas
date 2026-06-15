export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  failureWindowMs: number;
  openDurationMs: number;
  successThreshold: number;
}

interface FailureRecord {
  at: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  failureWindowMs: 60_000,
  openDurationMs: 30_000,
  successThreshold: 2,
};

export class ScanCircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: FailureRecord[] = [];
  private halfOpenSuccesses = 0;
  private openedAt: number | null = null;

  constructor(private readonly config: CircuitBreakerConfig = DEFAULT_CONFIG) {}

  recordSuccess(): void {
    if (this.state === 'half-open') {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.config.successThreshold) {
        this.state = 'closed';
        this.failures = [];
        this.halfOpenSuccesses = 0;
        this.openedAt = null;
      }
      return;
    }

    if (this.state === 'closed') {
      this.pruneFailures();
    }
  }

  recordFailure(): void {
    const now = Date.now();

    if (this.state === 'half-open') {
      this.tripOpen(now);
      return;
    }

    this.failures.push({ at: now });
    this.pruneFailures();

    if (this.failures.length >= this.config.failureThreshold) {
      this.tripOpen(now);
    }
  }

  canExecute(): boolean {
    this.maybeTransitionFromOpen();
    return this.state !== 'open';
  }

  getState(): CircuitState {
    this.maybeTransitionFromOpen();
    return this.state;
  }

  getStats(): { failures: number; successes: number; state: CircuitState } {
    this.maybeTransitionFromOpen();
    this.pruneFailures();
    return {
      failures: this.failures.length,
      successes: this.halfOpenSuccesses,
      state: this.state,
    };
  }

  private tripOpen(now: number): void {
    this.state = 'open';
    this.openedAt = now;
    this.halfOpenSuccesses = 0;
  }

  private maybeTransitionFromOpen(): void {
    if (this.state !== 'open' || this.openedAt === null) return;

    if (Date.now() - this.openedAt >= this.config.openDurationMs) {
      this.state = 'half-open';
      this.halfOpenSuccesses = 0;
      this.openedAt = null;
    }
  }

  private pruneFailures(): void {
    const cutoff = Date.now() - this.config.failureWindowMs;
    this.failures = this.failures.filter((f) => f.at >= cutoff);
  }
}

/** Module singleton for scan worker circuit breaker. */
export const scanCircuitBreaker = new ScanCircuitBreaker();
