/**
 * @file src/Shared/infrastructure/messaging/kafkaConfig.js
 * @description Centralized configuration loader for KafkaJS connection, producer, and consumer options.
 */

const parseBrokers = (brokersEnv) => {
  if (!brokersEnv) return ['localhost:9092'];
  return brokersEnv
    .split(',')
    .map((broker) => broker.trim())
    .filter(Boolean);
};

const getSaslConfig = () => {
  const username = process.env.KAFKA_SASL_USERNAME;
  const password = process.env.KAFKA_SASL_PASSWORD;
  const mechanism = process.env.KAFKA_SASL_MECHANISM || 'plain';

  if (!username || !password) {
    return undefined;
  }

  const normalizedMechanism = mechanism.toLowerCase();

  // KafkaJS requires exact casing depending on the SASL mechanism
  if (normalizedMechanism.includes('scram-sha-512')) {
    return { mechanism: 'scram-sha-512', username, password };
  }
  if (normalizedMechanism.includes('scram-sha-256')) {
    return { mechanism: 'scram-sha-256', username, password };
  }

  return {
    mechanism: 'plain',
    username,
    password,
  };
};

const isProduction = process.env.NODE_ENV === 'production';

const kafkaConfig = {
  /**
   * Primary connection settings for KafkaJS client initialization.
   */
  client: {
    clientId: process.env.KAFKA_CLIENT_ID || 'ledger-service',
    brokers: parseBrokers(process.env.KAFKA_BROKERS),
    ssl: process.env.KAFKA_SSL_ENABLED === 'true',
    sasl: getSaslConfig(),
    connectionTimeout: parseInt(process.env.KAFKA_CONN_TIMEOUT || '10000', 10),
    requestTimeout: parseInt(process.env.KAFKA_REQ_TIMEOUT || '30000', 10),
    retry: {
      initialRetryTime: parseInt(process.env.KAFKA_RETRY_INITIAL_TIME || '300', 10),
      retries: parseInt(process.env.KAFKA_RETRY_COUNT || '8', 10),
      maxRetryTime: 30000,
      factor: 0.2,
      multiplier: 2,
    },
  },

  /**
   * Default Producer configuration options.
   */
  producer: {
    allowAutoTopicCreation: !isProduction,
    transactionTimeout: parseInt(process.env.KAFKA_PRODUCER_TRX_TIMEOUT || '30000', 10),
    // Require all in-sync replicas to acknowledge (-1 or 'all') for strict ledger durability
    acks: -1,
    idempotent: true, // Guarantees exact-once delivery per producer session
  },

  /**
   * Default Consumer configuration options.
   */
  consumer: {
    groupId: process.env.KAFKA_CONSUMER_GROUP_ID || 'ledger-service-group',
    sessionTimeout: parseInt(process.env.KAFKA_CONSUMER_SESSION_TIMEOUT || '45000', 10),
    rebalanceTimeout: parseInt(process.env.KAFKA_CONSUMER_REBALANCE_TIMEOUT || '60000', 10),
    heartbeatInterval: parseInt(process.env.KAFKA_CONSUMER_HEARTBEAT_INTERVAL || '3000', 10),
    allowAutoTopicCreation: false,
    maxBytesPerPartition: 1048576, // 1MB per partition chunk
    readUncommitted: false, // Ensures consumers only read committed transactional messages
  },
};

module.exports = kafkaConfig;