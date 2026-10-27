// shared/persistence/errors/SerializationFailureError.js

/**
 * Thrown when a serializable transaction fails due to concurrent read/write 
 * conflicts (e.g., PostgreSQL error 40001 / serialization_failure).
 * Transactions encountering this error should typically be retried with jittered backoff.
 */
export class SerializationFailureError extends Error {
  constructor(message = 'Transaction serialization failure due to concurrent updates. Please retry.', originalError = null) {
    super(message, { cause: originalError }); // FIX 1: add cause chain
    this.name = 'SerializationFailureError';
    this.code = 'SERIALIZATION_FAILURE';
    this.statusCode = 409;
    this.isRetriable = true; // FIX 2: flag for retry middleware
    this.isTransient = true;
    this.originalError = originalError;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static isSerializationFailure(err) {
    return err?.code === '40001' || err?.code === '40P01';
  }
}