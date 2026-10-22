/**
 * Logging abstraction used across the application.
 * Infrastructure adapters (Pino, Winston, Test) implement this contract.
 */
export class ILogger {
  constructor() {
    if (this.constructor === ILogger) {
      throw new Error(
        "ILogger is an abstract interface and cannot be instantiated directly."
      );
    }
  }

  /**
   * Create a scoped logger with additional context.
   * @param {Object} context
   * @returns {ILogger}
   */
  child(context = {}) {
    throw new Error("Method child() must be implemented.");
  }

  /**
   * Debug-level logging.
   * @param {string} message
   * @param {Object} context
   */
  debug(message, context = {}) {
    throw new Error("Method debug() must be implemented.");
  }

  /**
   * Informational logging.
   * @param {string} message
   * @param {Object} context
   */
  info(message, context = {}) {
    throw new Error("Method info() must be implemented.");
  }

  /**
   * Warning logging.
   * @param {string} message
   * @param {Object|Error} errorOrContext
   */
  warn(message, errorOrContext = {}) {
    throw new Error("Method warn() must be implemented.");
  }

  /**
   * Error logging.
   * @param {string} message
   * @param {Object|Error} errorOrContext
   */
  error(message, errorOrContext = {}) {
    throw new Error("Method error() must be implemented.");
  }
}
