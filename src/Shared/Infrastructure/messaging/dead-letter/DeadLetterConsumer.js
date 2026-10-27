/**
 * @file src/Shared/infrastructure/messaging/dead-letter/DeadLetterConsumer.js
 * @description Listens to the DLQ channel for inspection, alerting, or re-drive processing.
 */

class DeadLetterConsumer {
  /**
   * @param {Object} params
   * @param {Object} params.brokerConsumer - Broker consumer client instance (e.g., KafkaJS consumer, AMQP channel)
   * @param {string} [params.dlqTopic='dead-letter-queue'] - Target DLQ topic or queue
   * @param {Object} [params.logger] - Logger instance
   */
  constructor({ brokerConsumer, dlqTopic = 'dead-letter-queue', logger = null }) {
    if (!brokerConsumer) {
      throw new Error('[DeadLetterConsumer] brokerConsumer is required.');
    }
    this.consumer = brokerConsumer;
    this.dlqTopic = dlqTopic;
    this.logger = logger;
    this.isRunning = false;
  }

  /**
   * Safely attempts to parse raw buffer values.
   * @private
   */
  _parseMessageValue(rawBuffer) {
    if (!rawBuffer) return null;
    const strValue = Buffer.isBuffer(rawBuffer) ? rawBuffer.toString('utf-8') : String(rawBuffer);

    try {
      return JSON.parse(strValue);
    } catch {
      // Fallback if the dead-letter payload is raw text or unformatted data
      return { payload: strValue, isUnparsedRaw: true };
    }
  }

  /**
   * Starts consuming DLQ entries.
   *
   * @param {(dlqRecord: Object) => Promise<void>} handlerFn - Handler function for DLQ items
   * @returns {Promise<void>}
   */
  async start(handlerFn) {
    if (typeof handlerFn !== 'function') {
      throw new Error('[DeadLetterConsumer] A handler function is required.');
    }

    if (this.logger) {
      this.logger.info(`[DeadLetterConsumer] Subscribing to DLQ topic '${this.dlqTopic}'...`);
    }

    this.isRunning = true;

    // Kafka-style API (e.g. KafkaJS)
    if (typeof this.consumer.subscribe === 'function' && typeof this.consumer.run === 'function') {
      await this.consumer.subscribe({ topic: this.dlqTopic, fromBeginning: false });

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          if (!this.isRunning) return;

          const parsedRecord = this._parseMessageValue(message.value);

          const dlqRecord = {
            topic,
            partition,
            offset: message.offset,
            key: message.key ? message.key.toString() : null,
            headers: message.headers || {},
            timestamp: message.timestamp,
            record: parsedRecord,
          };

          try {
            if (this.logger) {
              this.logger.debug(
                `[DeadLetterConsumer] Processing DLQ message at partition ${partition}, offset ${message.offset}`
              );
            }

            await handlerFn(dlqRecord);
          } catch (err) {
            if (this.logger) {
              this.logger.error(
                `[DeadLetterConsumer] Error in DLQ handler at offset ${message.offset}: ${err.message}`,
                { stack: err.stack }
              );
            }
            // Rethrowing allows KafkaJS / broker engine to manage retry/backoff on the DLQ consumer loop itself
            throw err;
          }
        },
      });
      return;
    }

    // RabbitMQ / AMQP style consume API
    if (typeof this.consumer.consume === 'function') {
      await this.consumer.consume(this.dlqTopic, async (msg) => {
        if (!msg || !this.isRunning) return;

        const parsedRecord = this._parseMessageValue(msg.content);

        try {
          await handlerFn({
            topic: this.dlqTopic,
            record: parsedRecord,
            rawMessage: msg,
          });
          if (typeof this.consumer.ack === 'function') {
            this.consumer.ack(msg);
          }
        } catch (err) {
          if (this.logger) {
            this.logger.error(`[DeadLetterConsumer] AMQP DLQ Handler Error: ${err.message}`);
          }
          if (typeof this.consumer.nack === 'function') {
            this.consumer.nack(msg, false, false); // Reject without requeueing to prevent spin loops
          }
        }
      });
      return;
    }

    throw new Error('[DeadLetterConsumer] Unrecognized consumer interface.');
  }

  /**
   * Gracefully stops the DLQ consumer.
   * @returns {Promise<void>}
   */
  async stop() {
    this.isRunning = false;
    if (this.logger) {
      this.logger.info('[DeadLetterConsumer] Stopping DLQ consumer connection...');
    }

    if (typeof this.consumer.disconnect === 'function') {
      await this.consumer.disconnect();
    } else if (typeof this.consumer.stop === 'function') {
      await this.consumer.stop();
    }
  }
}

module.exports = DeadLetterConsumer;