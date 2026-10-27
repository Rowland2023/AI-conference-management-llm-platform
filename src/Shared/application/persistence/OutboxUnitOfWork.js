/**
 * @file shared/application/persistence/OutboxUnitOfWork.js
 *
 * Coordinates:
 * - Database transaction
 * - Aggregate tracking
 * - Domain Event collection
 * - Transactional Outbox persistence
 *
 * Does NOT publish events.
 * Publishing is handled asynchronously by the Outbox Worker.
 */

const UnitOfWork = require('./UnitOfWork');

class OutboxUnitOfWork extends UnitOfWork {
  /**
   * @param {Object} params
   * @param {Object} params.transactionManager - Cross-cutting transaction manager (e.g., UnitOfWork)
   * @param {Object} params.outboxRepository - Repository for persisting outbox entries
   */
  constructor({ transactionManager, outboxRepository }) {
    super();

    if (!transactionManager) {
      throw new Error('[OutboxUnitOfWork] transactionManager is required.');
    }
    if (!outboxRepository) {
      throw new Error('[OutboxUnitOfWork] outboxRepository is required.');
    }

    this.transactionManager = transactionManager;
    this.outboxRepository = outboxRepository;
    this.trackedAggregates = new Set();
  }

  /**
   * Register an aggregate for event collection within the current unit of work.
   *
   * @param {Object} aggregate - Aggregate Root instance containing pullDomainEvents()
   */
  track(aggregate) {
    if (!aggregate) return;
    this.trackedAggregates.add(aggregate);
  }

  /**
   * Remove all tracked aggregates.
   */
  clear() {
    this.trackedAggregates.clear();
  }

  /**
   * Execute application work inside a transaction.
   *
   * Automatically collects domain events from tracked aggregates
   * and writes them into the Transactional Outbox table in the same transaction.
   *
   * @param {(tx: any) => Promise<any>} work - Work function accepting transaction client
   * @returns {Promise<any>}
   */
  async execute(work) {
    // Isolate tracked aggregates per execution to ensure thread/request safety
    const localTrackedSet = new Set(this.trackedAggregates);
    this.clear(); // Clear instance array immediately to prevent leak between executions

    return this.transactionManager.runInTransaction(async (tx) => {
      try {
        // 1. Pass execution context allowing inline tracking if needed
        const context = {
          tx,
          track: (agg) => localTrackedSet.add(agg),
        };

        const result = await work(context);

        // 2. Collect domain events from all registered aggregates
        const events = [];
        for (const aggregate of localTrackedSet) {
          if (typeof aggregate.pullDomainEvents === 'function') {
            const domainEvents = aggregate.pullDomainEvents();
            if (Array.isArray(domainEvents) && domainEvents.length > 0) {
              events.push(...domainEvents);
            }
          }
        }

        // 3. Persist outbox events in the active transaction
        if (events.length > 0) {
          await this.outboxRepository.save(events, tx);
        }

        return result;
      } finally {
        // Guaranteed cleanup regardless of success or failure
        localTrackedSet.clear();
        this.clear();
      }
    });
  }
}

module.exports = OutboxUnitOfWork;