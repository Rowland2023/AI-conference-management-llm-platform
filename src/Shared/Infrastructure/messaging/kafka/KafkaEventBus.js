/**
 * @file src/Shared/Infrastructure/messaging/kafka/KafkaEventBus.js
 * @description Kafka-backed event bus for publishing and consuming domain events.
 */

import { KafkaProducer } from "./KafkaProducer.js";
import { KafkaConsumer } from "./KafkaConsumer.js";
import RequestContext from "../../../../cross-cutting/context/request-context.js";

export class KafkaEventBus {
    constructor(params = {}) {
        const {
            kafkaConnection,
            groupId,
            logger = console,
        } = params;

        if (!kafkaConnection) {
            throw new Error(
                "KafkaEventBus requires 'kafkaConnection'."
            );
        }

        if (typeof kafkaConnection.getKafkaInstance !== "function") {
            throw new TypeError(
                "KafkaConnection must expose getKafkaInstance()."
            );
        }

        if (typeof groupId !== "string" || !groupId.trim()) {
            throw new TypeError(
                "KafkaEventBus requires a valid 'groupId'."
            );
        }

        const kafka = kafkaConnection.getKafkaInstance();

        if (!kafka) {
            throw new Error(
                "KafkaConnection returned an invalid Kafka instance."
            );
        }

        this.logger = logger;
        this.handlersMap = new Map();

        this.producer = new KafkaProducer({
            kafka,
            logger: this.logger,
        });

        this.consumer = new KafkaConsumer({
            kafka,
            groupId,
            logger: this.logger,
        });
    }

    /**
     * Connect the Kafka producer.
     */
    async initialize() {
        await this.producer.connect();
    }

    /**
     * Publish a domain event to a Kafka topic.
     */
    async publish(topic, event) {
        if (typeof topic !== "string" || !topic.trim()) {
            throw new TypeError("A valid Kafka topic is required.");
        }

        if (!event || typeof event !== "object") {
            throw new TypeError("A valid event object is required.");
        }

        const correlationId =
            RequestContext.getCorrelationId?.();

        const tenantId =
            RequestContext.getTenantId?.();

        const rawKey = event.aggregateId ?? event.id ?? event.eventId;

        const message = {
            key: rawKey != null ? String(rawKey) : null,
            value: {
                eventId: event.eventId ?? event.id,
                eventType: event.eventType ?? topic,
                occurredOn:
                    event.occurredOn ?? new Date().toISOString(),
                payload: event.payload ?? event,
            },
            headers: {
                ...(correlationId
                    ? { "x-correlation-id": String(correlationId) }
                    : {}),
                ...(tenantId
                    ? { "x-tenant-id": String(tenantId) }
                    : {}),
            },
        };

        await this.producer.publish(topic, [message]);
    }

    /**
     * Register a handler for a Kafka topic.
     * Returns the handler as an unsubscribe token.
     */
    subscribe(topic, handler) {
        if (typeof topic !== "string" || !topic.trim()) {
            throw new TypeError("A valid Kafka topic is required.");
        }

        if (typeof handler !== "function") {
            throw new TypeError("Event handler must be a function.");
        }

        const handlers = this.handlersMap.get(topic) ?? [];
        handlers.push(handler);
        this.handlersMap.set(topic, handlers);

        return handler;
    }

    /**
     * Remove a previously registered handler.
     */
    unsubscribe(topic, handler) {
        const handlers = this.handlersMap.get(topic);

        if (!handlers) {
            return;
        }

        const remaining = handlers.filter(
            (registeredHandler) => registeredHandler !== handler
        );

        if (remaining.length === 0) {
            this.handlersMap.delete(topic);
        } else {
            this.handlersMap.set(topic, remaining);
        }
    }

    /**
     * Subscribe to registered topics and dispatch received events.
     */
    async startConsuming() {
        const topics = [...this.handlersMap.keys()];

        if (topics.length === 0) {
            this.logger.warn?.(
                "KafkaEventBus started with no subscriptions."
            );
            return;
        }

        this.logger.info?.({
            message: "Starting Kafka consumers.",
            topics,
        });

        await this.consumer.subscribe(topics);

        await this.consumer.start(
            async ({ topic, payload, headers }) => {
                const handlers = this.handlersMap.get(topic) ?? [];

                if (handlers.length === 0) {
                    return;
                }

                const correlationId =
                    headers?.["x-correlation-id"] ??
                    headers?.["x-request-id"] ??
                    payload?.eventId;

                const tenantId = headers?.["x-tenant-id"];

                await RequestContext.run(
                    {
                        correlationId,
                        tenantId,
                        source: `kafka:${topic}`,
                    },
                    async () => {
                        for (const handler of handlers) {
                            try {
                                await handler(payload, headers);
                            } catch (error) {
                                this.logger.error?.(
                                    "Kafka event handler failed.",
                                    {
                                        topic,
                                        eventId: payload?.eventId,
                                        error,
                                    }
                                );

                                throw error;
                            }
                        }
                    }
                );
            }
        );
    }

    /**
     * Disconnect Kafka producer and consumer resources.
     */
    async shutdown() {
        const results = await Promise.allSettled([
            this.producer.disconnect(),
            this.consumer.disconnect(),
        ]);

        for (const result of results) {
            if (result.status === "rejected") {
                this.logger.error?.(
                    "Failed to shut down a Kafka event bus resource.",
                    { error: result.reason }
                );
            }
        }
    }
}
