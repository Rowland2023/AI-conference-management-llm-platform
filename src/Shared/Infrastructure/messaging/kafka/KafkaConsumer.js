/**
 * @file src/Shared/Infrastructure/messaging/kafka/KafkaConsumer.js
 * @description Kafka consumer adapter for the shared event bus.
 */

export class KafkaConsumer {
    constructor({ kafka, groupId, logger = console } = {}) {
        if (!kafka) {
            throw new TypeError("KafkaConsumer requires kafka.");
        }

        if (typeof groupId !== "string" || !groupId.trim()) {
            throw new TypeError("KafkaConsumer requires a valid groupId.");
        }

        this.logger = logger;
        this.consumer = kafka.consumer({
            groupId,
            allowAutoTopicCreation: false,
        });

        this.connected = false;
        this.subscribedTopics = new Set();
        this.started = false;
    }

    async connect() {
        if (this.connected) {
            return;
        }

        await this.consumer.connect();
        this.connected = true;
    }

    async subscribe(topics) {
        if (!Array.isArray(topics)) {
            throw new TypeError("KafkaConsumer.subscribe requires an array of topics.");
        }

        await this.connect();

        for (const topic of topics) {
            if (typeof topic !== "string" || !topic.trim()) {
                throw new TypeError("KafkaConsumer received an invalid topic.");
            }

            if (this.subscribedTopics.has(topic)) {
                continue;
            }

            await this.consumer.subscribe({
                topic,
                fromBeginning: false,
            });

            this.subscribedTopics.add(topic);
        }
    }

    async start(handler) {
        if (typeof handler !== "function") {
            throw new TypeError("KafkaConsumer.start requires a handler.");
        }

        await this.connect();

        if (this.started) {
            throw new Error("KafkaConsumer is already running.");
        }

        this.started = true;

        try {
            await this.consumer.run({
                eachMessage: async ({
                    topic,
                    partition,
                    message,
                }) => {
                    const rawValue = message.value?.toString();

                    let payload = null;

                    if (rawValue != null) {
                        try {
                            payload = JSON.parse(rawValue);
                        } catch (error) {
                            this.logger.error?.(
                                "Failed to parse Kafka message value.",
                                {
                                    topic,
                                    partition,
                                    offset: message.offset,
                                    error,
                                }
                            );

                            throw error;
                        }
                    }

                    const headers = {};

                    for (const [key, value] of Object.entries(
                        message.headers ?? {}
                    )) {
                        headers[key] =
                            value == null ? value : value.toString();
                    }

                    await handler({
                        topic,
                        partition,
                        payload,
                        headers,
                    });
                },
            });
        } catch (error) {
            this.started = false;
            throw error;
        }
    }

    async disconnect() {
        if (!this.connected) {
            return;
        }

        try {
            await this.consumer.disconnect();
        } finally {
            this.connected = false;
            this.started = false;
            this.subscribedTopics.clear();
        }
    }
}
