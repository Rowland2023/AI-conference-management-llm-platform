// src/shared/infrastructure/middleware/correlationId.js

import crypto from "node:crypto";

/**
 * Assigns or propagates a Correlation ID for every incoming request.
 *
 * Priority:
 * 1. Existing X-Correlation-Id header
 * 2. Existing X-Request-Id header
 * 3. Generate a new UUID
 */
export function correlationIdMiddleware(req, res, next) {
  const correlationId =
    req.headers["x-correlation-id"] ||
    req.headers["x-request-id"] ||
    crypto.randomUUID();

  // Attach to request
  req.correlationId = correlationId;

  // Make available to downstream middleware/controllers
  res.locals.correlationId = correlationId;

  // Return to client
  res.setHeader("X-Correlation-Id", correlationId);

  next();
}