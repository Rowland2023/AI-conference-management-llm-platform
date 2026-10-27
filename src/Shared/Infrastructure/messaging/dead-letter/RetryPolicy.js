/**
 * @file src/Shared/infrastructure/messaging/dead-letter/RetryPolicy.js
 * @description Encapsulates retry decision logic, max attempt thresholds, exponential backoff, and full/equal jitter.
 */

class RetryPolicy {
  /**
   * @param {Object} [options]
   * @param {number} [options.maxRetries=5] - Maximum retry attempts (excluding initial attempt)
   * @param {number} [options.initialDelayMs=1000] - Base delay in milliseconds
   * @param {number} [options.maxDelayMs=60000] - Maximum cap for backoff delay
   * @param {number} [options.backoffFactor=2] - Exponential multiplier
   * @param {boolean} [options.useEqualJitter=true] - Uses equal jitter to guarantee a lower bound delay
   */
  constructor({
    maxRetries = 5,
    initialDelayMs = 1000,
    maxDelayMs = 60000,
    backoffFactor = 2,
    useEqualJitter = true,
  } = {}) {
    this.maxRetries = Math.max(0, Number(maxRetries) || 0);
    this.initialDelayMs = Math.max(10, Number(initialDelayMs) || 1000);
    this.maxDelayMs = Math.max(this.initialDelayMs, Number(maxDelayMs) || 60000);
    this.backoffFactor = Math.max(1, Number(backoffFactor) || 2);
    this.useEqualJitter = Boolean(useEqualJitter);
  }

  /**
   * Determines if a failed message is eligible for another processing attempt.
   *
   * @param {number} currentAttempt - Current execution attempt (1-based: 1 = initial run, 2 = 1st retry)
   * @param {Error} [error=null] - Optional error instance to inspect non-retryable flags
   * @returns {boolean}
   */
  shouldRetry(currentAttempt, error = null) {
    if (error && error.isNonRetryable === true) {
      return false;
    }

    const attemptNum = Number(currentAttempt) || 1;
    // Attempt 1 = initial attempt. Total attempts allowed = 1 initial + maxRetries
    return attemptNum <= this.maxRetries;
  }

  /**
   * Calculates backoff delay with exponential factor and jitter options.
   *
   * @param {number} attempt - Execution attempt count (1-based)
   * @returns {number} Delay in milliseconds
   */
  getBackoffDelay(attempt) {
    const attemptNum = Math.max(1, Number(attempt) || 1);
    
    // Exponential calculation capped at maxDelayMs
    const calculatedDelay = this.initialDelayMs * Math.pow(this.backoffFactor, attemptNum - 1);
    const cappedDelay = Math.min(calculatedDelay, this.maxDelayMs);

    if (this.useEqualJitter) {
      // Equal Jitter: Half delay guaranteed + half randomized
      // Prevents near-zero delays while maintaining collision avoidance
      const halfDelay = cappedDelay / 2;
      return Math.floor(halfDelay + Math.random() * halfDelay);
    }

    // Full Jitter: rand(0, cappedDelay)
    return Math.floor(Math.random() * cappedDelay);
  }
}

module.exports = RetryPolicy;