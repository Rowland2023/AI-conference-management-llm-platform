/**
 * @file src/Shared/infrastructure/outbox/EventPublisher.js
 * @description In-transaction event publisher that writes domain events to the Outbox table.
 */
const OutboxSerializer = require('./OutboxSerializer');

class EventPublisher {
  /**
   * @param {Object} params
   * @param {Object} params.outboxRepository - Instance of OutboxRepository
   * @param {Object} [params.logger] - Application logger instance
   * @param {boolean} [params.enforceTransaction=false] - If true, throws an error if trx is omitted
   */
  constructor({ outboxRepository, logger, enforceTransaction = false }) {
    if (!outboxRepository) {
      throw new Error('[EventPublisher] outboxRepository is required.');
    }
    this.outboxRepository = outboxRepository;
    this.logger = logger;
    this.enforceTransaction = enforceTransaction;
  }

  /**
   * Serializes and writes a single domain event into the Outbox database table.
   *
   * @param {Object} event - Domain event entity
   * @param {Object} [trx] - Active database transaction client (Knex/Prisma/PG Client)
   * @param {Object} [customHeaders] - Optional headers override
   * @returns {Promise<Object>} The inserted outbox record
   */
  async publish(event, trx = null, customHeaders = {}) {
    if (!event) return null;

    if (this.enforceTransaction && !trx) {
      throw new Error(
        `[EventPublisher] Transaction context (trx) is required to write event '${event.eventType || event.constructor?.name}' atomically.`
      );
    }

    const serializedRecord = OutboxSerializer.serialize({ event, customHeaders });

    if (this.logger) {
      this.logger.info(`[EventPublisher] Staging event '${serializedRecord.event_type}' to outbox.`, {
        eventId: serializedRecord.id,
        aggregateId: serializedRecord.aggregate_id,
        hasTransaction: Boolean(trx),
      });
    }

    return await this.outboxRepository.save(serializedRecord, trx);
  }

  /**
   * Batch publishes multiple domain events within a single database transaction.
   *
   * @param {Array<Object>} events - Array of domain event entities
   * @param {Object} [trx] - Active database transaction client
   * @param {Object} [customHeaders] - Optional headers override
   * @returns {Promise<Array<Object>>}
   */
  async publishAll(events = [], trx = null, customHeaders = {}) {
    if (!Array.isArray(events) || events.length === 0) return [];

    if (this.enforceTransaction && !trx) {
      throw new Error(
        `[EventPublisher] Transaction context (trx) is required to write batch of ${events.length} events atomically.`
      );
    }

    const records = events
      .filter(Boolean)
      .map((event) => OutboxSerializer.serialize({ event, customHeaders }));

    if (records.length === 0) return [];

    if (this.logger) {
      this.logger.info(`[EventPublisher] Staging ${records.length} events to outbox.`, {
        hasTransaction: Boolean(trx),
      });
    }

    // Use native batch insert if available; fall back to sequential loop within trx
    if (typeof this.outboxRepository.saveBatch === 'function') {
      return await this.outboxRepository.saveBatch(records, trx);
    }

    const results = [];
    for (const record of records) {
      const saved = await this.outboxRepository.save(record, trx);
      results.push(saved);
    }
    return results;
  }
}

module.exports = EventPublisher;