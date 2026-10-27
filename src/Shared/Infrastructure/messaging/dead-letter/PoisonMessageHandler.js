/**
 * @file src/Shared/infrastructure/messaging/dead-letter/PoisonMessageHandler.js
 * @description Inspects message processing errors to identify non-recoverable "poison" payloads.
 */

class PoisonMessageHandler {
  /**
   * @param {Object} [params]
   * @param {Array<Function|string>} [params.fatalErrorTypes] - Error constructors or names that trigger immediate poisoning
   * @param {Object} [params.logger] - Logger instance
   */
  constructor({
    fatalErrorTypes = [
      SyntaxError,
      'ValidationError',
      'ZodError',
      'ERR_INVALID_ARG_TYPE',
    ],
    logger = null,
  } = {}) {
    this.fatalErrorTypes = fatalErrorTypes;
    this.logger = logger;
  }

  /**
   * Checks if an exception represents a non-recoverable poison message.
   *
   * @param {Error} error - Caught execution error
   * @param {Object} [message] - Raw message payload
   * @returns {boolean} True if the message is unprocessable and should skip retries
   */
  isPoisonMessage(error, message = null) {
    if (!error) return false;

    // 1. Check for explicit poison/fatal flags on custom Domain or Application errors
    if (
      error.isPoison === true ||
      error.isFatal === true ||
      error.isNonRetryable === true ||
      error.status === 400 ||
      error.statusCode === 400
    ) {
      this._logPoison(error, message, 'Explicit Error Flag');
      return true;
    }

    // 2. Direct type, name, or code matching against configured fatal types
    const isFatalType = this.fatalErrorTypes.some((type) => {
      if (typeof type === 'function') {
        return error instanceof type;
      }
      if (typeof type === 'string') {
        return (
          error.name === type ||
          error.code === type ||
          error.constructor?.name === type
        );
      }
      return false;
    });

    if (isFatalType) {
      this._logPoison(error, message, 'Fatal Error Type Match');
      return true;
    }

    return false;
  }

  /**
   * Helper for consistent warning logs when poison payload is detected.
   * @private
   */
  _logPoison(error, message, reason) {
    if (!this.logger) return;

    const messageId =
      message?.headers?.messageId ||
      message?.id ||
      message?.key ||
      'unknown-id';

    this.logger.warn(
      `[PoisonMessageHandler] Classified payload as POISON message. Reason: ${reason}. Error: ${error.message}`,
      {
        messageId,
        errorName: error.name,
        errorCode: error.code,
      }
    );
  }

  /**
   * Wraps metadata around the poison payload before passing to the DLQ.
   * Prevents circular-reference JSON serialization errors on storage.
   *
   * @param {Object} message - Original payload
   * @param {Error} error - Causing exception
   * @returns {Object} Enriched poison envelope
   */
  buildPoisonEnvelope(message, error) {
    return {
      originalMessage: message,
      poisonReason: {
        errorName: error?.name || 'UnknownError',
        errorMessage: error?.message || 'No error message provided',
        errorCode: error?.code || null,
        stack: error?.stack || null,
        classifiedAt: new Date().toISOString(),
      },
    };
  }
}

module.exports = PoisonMessageHandler;