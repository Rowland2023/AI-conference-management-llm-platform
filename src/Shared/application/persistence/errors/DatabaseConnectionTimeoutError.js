// shared/persistence/errors/DatabaseConnectionTimeoutError.js

/**
 * Thrown when a database query or connection attempt exceeds the allocated time limit.
 */
export class DatabaseConnectionTimeoutError extends Error {
  constructor(message = 'Database operation timed out.', originalError = null) {
    super(message);
    this.name = 'DatabaseConnectionTimeoutError';
    this.code = 'DATABASE_CONNECTION_TIMEOUT';
    this.statusCode = 504;
    this.originalError = originalError;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}