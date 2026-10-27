/**
 * @file src/Shared/infrastructure/messaging/dead-letter/DeadLetterPublisher.js
 * @description Publishes dead-letter messages to designated broker DLQ topics or exchanges safely.
 */

class DeadLetterPublisher {
  /**
   * @param {Object} params
   * @param {Object} params.brokerProducer - Broker producer client (e.g. KafkaJS, amqplib)
   * @param {string} [params.dlqTopic='dead-letter-queue'] - Target DLQ topic/queue name
   * @param {Object} [params.logger] - Logger instance
   */
  constructor({ brokerProducer, dlqTopic = 'dead-letter-queue', logger = null }) {
    if (!brokerProducer) {
      throw new Error('[DeadLetterPublisher] brokerProducer is required.');
    }
    this.producer = brokerProducer;
    this.dlqTopic = dlqTopic;
    this.logger = logger;
  }

  /**
   * Safely serializes objects with circular references or unhandled types.
   * @private
   */
  _safeStringify(obj) {
    const cache = new Set();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) {
          return '[Circular Reference]';
        }
        cache.add(value);
      }
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack,
        };
      }
      return value;
    });
  }

  /**
   * Normalizes arbitrary message payload to a safe object or string.
   * @private
   */
  _normalizePayload(payload) {
    if (Buffer.isBuffer(payload)) {
      try {
        return JSON.parse(payload.toString('utf-8'));
      } catch {
        return payload.toString('utf-8');
      }
    }
    return payload;
  }

  /**
   * Routes a failed or poison message to the DLQ topic with diagnostic metadata.
   *
   * @param {Object} message - Raw message instance or payload
   * @param {Error} error - Cause of failure
   * @param {Object} [context={}] - Additional runtime metadata (e.g. attempts, consumer group)
   * @returns {Promise<void>}
   */
  async publish(message, error, context = {}) {
    try {
      const rawPayload = message.payload !== undefined ? message.payload : message;
      const key = message.key || context.key || null;

      const envelope = {
        payload: this._normalizePayload(rawPayload),
        metadata: {
          originalTopic: context.originalTopic || message.topic || 'UNKNOWN',
          consumerGroup: context.consumerGroup || 'UNKNOWN',
          attemptsCount: context.attempts || 1,
          deathTimestamp: new Date().toISOString(),
          deathReason: {
            message: error?.message || 'Unknown error',
            name: error?.name || 'Error',
            stack: error?.stack || null,
            code: error?.code || null,
          },
        },
        headers: {
          ...(message.headers || {}),
          'x-dead-letter-reason': String(error?.message || 'Unknown error'),
          'x-original-topic': String(context.originalTopic || message.topic || 'UNKNOWN'),
          'x-death-timestamp': new Date().toISOString(),
        },
      };

      if (this.logger) {
        this.logger.error(
          `[DeadLetterPublisher] Routing message to DLQ topic '${this.dlqTopic}'. Reason: ${error?.message}`,
          { key, originalTopic: envelope.metadata.originalTopic }
        );
      }

      const serializedEnvelope = this._safeStringify(envelope);

      // Kafka-style API (e.g. KafkaJS, RdKafka)
      if (typeof this.producer.send === 'function') {
        await this.producer.send({
          topic: this.dlqTopic,
          messages: [
            {
              key: key ? String(key) : null,
              value: serializedEnvelope,
              headers: envelope.headers,
            },
          ],
        });
        return;
      }

      // RabbitMQ-style API (e.g. amqplib)
      if (typeof this.producer.publish === 'function') {
        await this.producer.publish(
          '',
          this.dlqTopic,
          Buffer.from(serializedEnvelope),
          { headers: envelope.headers }
        );
        return;
      }

      throw new Error('[DeadLetterPublisher] Unrecognized broker producer interface.');
    } catch (publishError) {
      if (this.logger) {
        this.logger.error(
          `[DeadLetterPublisher] FATAL: Failed to route message to DLQ: ${publishError.message}`,
          { stack: publishError.stack }
        );
      }
      throw publishError;
    }
  }
}

module.exports = DeadLetterPublisher;