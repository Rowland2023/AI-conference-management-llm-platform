/**
 * @file src/Shared/Infrastructure/messaging/outbox/outboxworker.js
 * @description Transactional Outbox background worker.
 */

export class OutboxWorker {
    constructor({
        outboxRepository,
        eventBus,
        logger = console,
        pollIntervalMs = 3000,
        batchSize = 100,
        maxRetries = 5,
    } = {}) {
        if (!outboxRepository) {
            throw new TypeError(
                "OutboxWorker requires an outboxRepository."
            );
        }

        if (!eventBus || typeof eventBus.publish !== "function") {
            throw new TypeError(
                "OutboxWorker requires an eventBus with publish()."
            );
        }

        this.outboxRepository = outboxRepository;
        this.eventBus = eventBus;
        this.logger = logger;
        this.pollIntervalMs = pollIntervalMs;
        this.batchSize = batchSize;
        this.maxRetries = maxRetries;

        this.running = false;
        this.timer = null;
        this.inFlight = null;
    }

    start() {
        if (this.running) {
            return;
        }

        this.running = true;

        this.logger.info?.("[OutboxWorker] Started.");

        this.inFlight = this.#schedule();
    }

    async stop() {
        this.running = false;

        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        // Allow an active batch to finish before shutdown completes.
        if (this.inFlight) {
            await this.inFlight;
        }

        this.logger.info?.("[OutboxWorker] Stopped.");
    }

    async #schedule() {
        while (this.running) {
            try {
                await this.#processBatch();
            } catch (error) {
                this.logger.error?.(
                    "[OutboxWorker] Batch processing failed.",
                    error
                );
            }

            if (!this.running) {
                break;
            }

            await new Promise((resolve) => {
                this.timer = setTimeout(() => {
                    this.timer = null;
                    resolve();
                }, this.pollIntervalMs);
            });
        }
    }

    async #processBatch() {
        const events =
            await this.outboxRepository.fetchAndLockPending(
                this.batchSize,
                this.maxRetries
            );

        if (!Array.isArray(events) || events.length === 0) {
            return;
        }

        this.logger.info?.(
            `[OutboxWorker] Processing ${events.length} event(s).`
        );

        for (const event of events) {
            await this.#publish(event);
        }
    }

    async #publish(event) {
        const eventId = event.id;
        const eventName = event.event_name ?? event.event_type;

        try {
            if (!eventName) {
                throw new Error(
                    `Outbox event ${eventId} has no event name/type.`
                );
            }

            const payload =
                typeof event.payload === "string"
                    ? JSON.parse(event.payload)
                    : event.payload;

            await this.eventBus.publish(eventName, payload);

            await this.outboxRepository.markAsDispatched(eventId);

            this.logger.info?.(
                `[OutboxWorker] Published ${eventName}.`
            );
        } catch (error) {
            this.logger.error?.(
                `[OutboxWorker] Failed publishing ${eventName ?? eventId}.`,
                error
            );

            try {
                await this.outboxRepository.incrementRetry(
                    eventId,
                    error instanceof Error
                        ? error.message
                        : String(error)
                );
            } catch (retryError) {
                this.logger.error?.(
                    `[OutboxWorker] Failed to record retry for ${eventId}.`,
                    retryError
                );
            }
        }
    }
}
