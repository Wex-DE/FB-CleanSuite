export interface BackoffDecision {
  action: 'proceed' | 'retry_after_delay' | 'pause_worker' | 'skip_item' | 'fail_item';
  delaySeconds: number;
  reason: string;
}

export class BackoffManager {
  private baseDelaySeconds: number;
  private currentDelaySeconds: number;
  private backoffLevel: number;
  private consecutiveFailures: number;
  private maxConsecutiveFailures: number;

  constructor(baseDelaySeconds = 60, maxConsecutiveFailures = 5) {
    this.baseDelaySeconds = Math.max(1, baseDelaySeconds);
    this.currentDelaySeconds = this.baseDelaySeconds;
    this.backoffLevel = 0;
    this.consecutiveFailures = 0;
    this.maxConsecutiveFailures = maxConsecutiveFailures;
  }

  public setBaseDelay(seconds: number): void {
    this.baseDelaySeconds = Math.max(1, seconds);
    if (this.backoffLevel === 0) {
      this.currentDelaySeconds = this.baseDelaySeconds;
    }
  }

  public getBaseDelay(): number {
    return this.baseDelaySeconds;
  }

  public getCurrentDelay(): number {
    return this.currentDelaySeconds;
  }

  public getBackoffLevel(): number {
    return this.backoffLevel;
  }

  public getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  public recordSuccess(): BackoffDecision {
    this.backoffLevel = 0;
    this.consecutiveFailures = 0;
    this.currentDelaySeconds = this.baseDelaySeconds;
    return {
      action: 'proceed',
      delaySeconds: this.baseDelaySeconds,
      reason: 'Previous action succeeded. Using configured standard delay.',
    };
  }

  public recordRateLimit(code: number, message: string): BackoffDecision {
    this.consecutiveFailures++;
    this.backoffLevel++;

    // Exponential scale with safety cap
    // e.g. 5m, 15m, 30m, 60m
    const multiplier = Math.min(Math.pow(2, this.backoffLevel), 16);
    this.currentDelaySeconds = Math.max(300, this.baseDelaySeconds * multiplier);

    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      return {
        action: 'pause_worker',
        delaySeconds: this.currentDelaySeconds,
        reason: `Rate limit hit repeatedly (${this.consecutiveFailures} consecutive times). Pausing worker for safety. Code: ${code}. Message: ${message}`,
      };
    }

    return {
      action: 'retry_after_delay',
      delaySeconds: this.currentDelaySeconds,
      reason: `Meta API rate limit encountered (Code ${code}). Backing off for ${this.currentDelaySeconds} seconds.`,
    };
  }

  public recordTransientError(status: number, message: string): BackoffDecision {
    this.consecutiveFailures++;
    this.backoffLevel++;

    const delay = Math.min(this.baseDelaySeconds * Math.pow(1.5, this.backoffLevel), 600);
    this.currentDelaySeconds = Math.round(delay);

    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      return {
        action: 'pause_worker',
        delaySeconds: this.currentDelaySeconds,
        reason: `Too many consecutive transient errors (${this.consecutiveFailures}). Pausing worker. Status: ${status}`,
      };
    }

    return {
      action: 'retry_after_delay',
      delaySeconds: this.currentDelaySeconds,
      reason: `Transient error (HTTP ${status}: ${message}). Retrying in ${this.currentDelaySeconds}s.`,
    };
  }

  public recordPermanentFailure(reason: string): BackoffDecision {
    // Non-retryable post-specific failure does not necessarily increase backoff delay for the whole worker,
    // but resets failure counter if worker is healthy.
    this.consecutiveFailures = 0;
    return {
      action: 'fail_item',
      delaySeconds: this.baseDelaySeconds,
      reason,
    };
  }
}
