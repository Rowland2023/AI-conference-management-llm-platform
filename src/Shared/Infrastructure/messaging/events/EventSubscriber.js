/**
 * @file src/Shared/infrastructure/messaging/EventSubscriber.js
 * @description Manages incoming event topic subscriptions, context wrapping, and execution handlers.
 */
const RequestContext = require('../../cross-cutting/request-context');

class EventSubscriber {
  /**
   * @param {Object} params
   * @param {import('./KafkaEventBus')} params.eventBus - Instance of KafkaEventBus
   * @param {Object} [params.idempotencyService] - Optional idempotency manager instance
   * @param {Object} [params.logger] - Application logger instance
   */
  constructor({ eventBus, idempotencyService = null, logger = null }) {
    if (!eventBus) {
      throw new Error('[EventSubscriber] eventBus instance is required.');
    }
    this.eventBus = eventBus;
    this.idempotencyService = idempotencyService;
    this.logger = logger;
  }

  /**
   * Safely normalizes header values whether they arrive as Strings or Buffers.
   * @private
   */
  _getHeaderValue(headers, key) {
    if (!headers || !headers[key]) return null;
    const value = headers[key];
    return Buffer.isBuffer(value) ? value.toString('utf-8') : String(value);
  }

  /**
   * Subscribes a handler to a specific event topic with tracing and error handling.
   *
   * @param {string} topic - Topic name (e.g., 'payments.transaction.completed')
   * @param {Function} handler - Async business handler `async (data, headers)`
   * @param {Object} [options]
   * @param {boolean} [options.idempotent=true] - Whether to apply idempotency checks
   * @param {number} [options.lockTtlMs=60000] - Lock duration for in-flight processing
   */
  subscribe(topic, handler, options = {}) {
    const isIdempotent = options.idempotent ?? true;
    const lockTtlMs = options.lockTtlMs || 60000;

    const wrappedHandler = async (payload, rawHeaders = {}) => {
      // 1. Normalize Kafka Headers (Convert Buffers to Strings)
      const correlationId =
        this._getHeaderValue(rawHeaders, 'x-correlation-id') ||
        this._getHeaderValue(rawHeaders, 'correlationId') ||
        payload?.eventId ||
        null;

      const tenantId =
        this._getHeaderValue(rawHeaders, 'x-tenant-id') ||
        this._getHeaderValue(rawHeaders, 'tenantId') ||
        null;

      const eventId = payload?.eventId || payload?.id;

      // 2. Wrap execution thread in RequestContext
      return RequestContext.run({ correlationId, tenantId, source: `subscriber:${topic}` }, async () => {
        let acquiredLock = false;

        try {
          // 3. Concurrency-Safe Idempotency Handling
          if (isIdempotent && this.idempotencyService && eventId) {
            // Check if already completely processed
            const alreadyProcessed = await this.idempotencyService.hasBeenProcessed(eventId);
            if (alreadyProcessed) {
              if (this.logger) {
                this.logger.warn(`[EventSubscriber] Skipping duplicate event '${topic}'`, { eventId });
              }
              return;
            }

            // Acquire processing lock / state marker atomically to prevent parallel execution race conditions
            if (typeof this.idempotencyService.acquireLock === 'function') {
              acquiredLock = await this.idempotencyService.acquireLock(eventId, lockTtlMs);
              if (!acquiredLock) {
                if (this.logger) {
                  this.logger.warn(`[EventSubscriber] Concurrent processing detected for event '${topic}', ignoring duplicate worker.`, { eventId });
                }
                return;
              }
            }
          }

          if (this.logger) {
            this.logger.info(`[EventSubscriber] Processing event '${topic}'`, { eventId, correlationId });
          }

          // 4. Extract Event Data Safely
          const eventData = payload?.data !== undefined ? payload.data : (payload?.payload !== undefined ? payload.payload : payload);

          // 5. Execute Domain Handler
          await handler(eventData, rawHeaders);

          // 6. Mark as Processed (Release or complete lock status)
          if (isIdempotent && this.idempotencyService && eventId) {
            await this.idempotencyService.markAsProcessed(eventId);
          }
        } catch (error) {
          if (this.logger) {
            this.logger.error(`[EventSubscriber] Error handling event '${topic}'`, {
              eventId,
              error: error.message,
              stack: error.stack,
            });
          }

          // If execution failed, release the atomic processing lock so retries can pick it up
          if (acquiredLock && typeof this.idempotencyService.releaseLock === 'function') {
            await this.idempotencyService.releaseLock(eventId).catch(() => {});
          }

          throw error; // Re-throw to trigger Kafka consumer retry or DLQ policy
        }
      });
    };

    // Register with the underlying Kafka EventBus
    this.eventBus.subscribe(topic, wrappedHandler);
  }

  /**
   * Starts listening to all subscribed topics.
   */
  async start() {
    await this.eventBus.startConsuming();
  }
}

module.exports = EventSubscriber;