/**
 * @file src/Shared/infrastructure/messaging/dead-letter/DeadLetterQueue.js
 * @description Orchestrates message execution, retries with backoff, poison message detection, and DLQ dispatch.
 */

const RetryPolicy = require('./RetryPolicy');
const PoisonMessageHandler = require('./PoisonMessageHandler');
const DeadLetterPublisher = require('./DeadLetterPublisher');

class DeadLetterQueue {
  /**
   * @param {Object} params
   * @param {DeadLetterPublisher} params.dlqPublisher - Publisher instance for dead-lettering
   * @param {RetryPolicy} [params.retryPolicy] - Strategy for retry management
   * @param {PoisonMessageHandler} [params.poisonHandler] - Classifier for poison messages
   * @param {Object} [params.logger] - Application logger instance
   */
  constructor({
    dlqPublisher,
    retryPolicy = new RetryPolicy(),
    poisonHandler = new PoisonMessageHandler(),
    logger = null,
  }) {
    if (!dlqPublisher) {
      throw new Error('[DeadLetterQueue] dlqPublisher is required.');
    }

    this.dlqPublisher = dlqPublisher;
    this.retryPolicy = retryPolicy;
    this.poisonHandler = poisonHandler;
    this.logger = logger;
  }

  /**
   * Sleep helper with AbortSignal support to allow immediate exit on SIGTERM/SIGINT.
   * @private
   */
  _sleep(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        return reject(new Error('Processing aborted during backoff delay.'));
      }

      const timer = setTimeout(resolve, ms);

      if (signal) {
        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            reject(new Error('Processing aborted during backoff delay.'));
          },
          { once: true }
        );
      }
    });
  }

  /**
   * Processes a message with full retry lifecycle and DLQ fallback.
   *
   * @param {Object} message - Raw incoming broker message payload
   * @param {(msg: Object) => Promise<any>} handlerFn - Business processing delegate
   * @param {Object} [context={}] - Context metadata (e.g., topic, partition, signal)
   * @param {AbortSignal} [context.signal] - Optional abort signal for graceful process shutdown
   * @returns {Promise<any>}
   */
  async process(message, handlerFn, context = {}) {
    if (typeof handlerFn !== 'function') {
      throw new Error('[DeadLetterQueue] A valid handler function is required.');
    }

    let attempt = 0;

    while (true) {
      attempt++;

      try {
        if (this.logger && attempt > 1) {
          this.logger.info(
            `[DeadLetterQueue] Executing attempt ${attempt} for message`,
            { key: message?.key, topic: context.originalTopic || message?.topic }
          );
        }

        // Execute business handler function
        return await handlerFn(message);
      } catch (error) {
        // Check for process termination / abort signals first
        if (context.signal?.aborted) {
          if (this.logger) {
            this.logger.warn('[DeadLetterQueue] Execution aborted due to system shutdown signal.');
          }
          throw error;
        }

        // 1. Check if payload is an unrecoverable poison message
        if (this.poisonHandler.isPoisonMessage(error, message)) {
          if (this.logger) {
            this.logger.error(
              `[DeadLetterQueue] Poison message detected (${error.message}). Routing to DLQ immediately.`
            );
          }
          await this.dlqPublisher.publish(message, error, {
            ...context,
            attempts: attempt,
            poison: true,
          });
          return null; // Handled & routed to DLQ; acknowledge from primary consumer loop
        }

        // 2. Check if retries are exhausted (passes attempt and error to policy)
        if (!this.retryPolicy.shouldRetry(attempt, error)) {
          if (this.logger) {
            this.logger.error(
              `[DeadLetterQueue] Retry limit exceeded or non-retryable error (Attempts: ${attempt}). Routing to DLQ.`
            );
          }
          await this.dlqPublisher.publish(message, error, {
            ...context,
            attempts: attempt,
            poison: false,
          });
          return null; // Handled & routed to DLQ
        }

        // 3. Compute backoff delay with jitter
        const delayMs = this.retryPolicy.getBackoffDelay(attempt);

        if (this.logger) {
          this.logger.warn(
            `[DeadLetterQueue] Attempt ${attempt} failed (${error.message}). Backoff for ${delayMs}ms...`
          );
        }

        // 4. Backoff sleep before next attempt
        await this._sleep(delayMs, context.signal);
      }
    }
  }
}

module.exports = DeadLetterQueue;