// shared/persistence/errors/DatabaseUnavailableError.js

/**
 * Thrown when the database cluster, pool, or connection is unreachable,
 * offline, or rejecting new client connections.
 * This is a transient infrastructure error and MUST be retried with backoff.
 */
export class DatabaseUnavailableError extends Error {
  constructor(message = 'Database service is currently unavailable.', originalError = null) {
    super(message, { cause: originalError });
    this.name = 'DatabaseUnavailableError';
    this.code = 'DATABASE_UNAVAILABLE';
    this.statusCode = 503;
    this.isRetriable = true;
    this.isTransient = true;
    this.originalError = originalError;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static isDatabaseUnavailable(err) {
    if (!err) return false;
    const codes = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH', '57P03', '53300'];
    return codes.includes(err.code) || 
           err.message?.includes('too many clients') ||
           err.message?.includes('connection terminated');
  }
}