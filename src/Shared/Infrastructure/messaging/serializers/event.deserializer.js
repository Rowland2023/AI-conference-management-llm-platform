/**
 * @file src/Shared/infrastructure/messaging/serialization/event.deserializer.js
 * @description Rehydrates raw transport messages into structured domain event envelopes.
 */

export class EventDeserializer {
  /**
   * Converts Kafka/MQ header values (Strings or Buffers) into clean UTF-8 strings.
   * @private
   */
  static _normalizeHeaders(rawHeaders = {}) {
    if (!rawHeaders || typeof rawHeaders !== "object") {
      return {};
    }

    const normalized = {};

    for (const [key, val] of Object.entries(rawHeaders)) {
      if (val === undefined || val === null) {
        continue;
      }

      const lowerKey = key.toLowerCase();

      if (Buffer.isBuffer(val)) {
        normalized[lowerKey] = val.toString("utf-8");
      } else if (
        Array.isArray(val) &&
        Buffer.isBuffer(val[0])
      ) {
        normalized[lowerKey] = val[0].toString("utf-8");
      } else {
        normalized[lowerKey] = String(val);
      }
    }

    return normalized;
  }


  /**
   * Deserializes a raw Kafka message or Outbox row into a strongly-typed domain event envelope.
   *
   * @param {string|Buffer|Object} rawInput
   * @param {Object} [transportHeaders={}]
   * @returns {Object}
   */
  static deserialize(rawInput, transportHeaders = {}) {
    if (!rawInput) {
      throw new Error(
        "[EventDeserializer] Cannot deserialize empty or null payload."
      );
    }

    let parsed;


    if (Buffer.isBuffer(rawInput)) {
      try {
        parsed = JSON.parse(
          rawInput.toString("utf-8")
        );
      } catch (err) {
        throw new Error(
          `[EventDeserializer] Failed to parse Buffer as JSON: ${err.message}`
        );
      }

    } else if (typeof rawInput === "string") {
      try {
        parsed = JSON.parse(rawInput);
      } catch (err) {
        throw new Error(
          `[EventDeserializer] Failed to parse JSON string: ${err.message}`
        );
      }

    } else if (typeof rawInput === "object") {
      parsed = rawInput;

    } else {
      throw new Error(
        `[EventDeserializer] Unsupported raw payload input type: ${typeof rawInput}`
      );
    }


    const normalizedTransportHeaders =
      EventDeserializer._normalizeHeaders(
        transportHeaders
      );


    const normalizedEnvelopeHeaders =
      EventDeserializer._normalizeHeaders(
        parsed.headers
      );


    const mergedHeaders = {
      ...normalizedTransportHeaders,
      ...normalizedEnvelopeHeaders,
    };


    let payloadData;


    if (parsed.payload !== undefined) {
      payloadData = parsed.payload;

    } else if (parsed.data !== undefined) {
      payloadData = parsed.data;

    } else {
      const {
        eventId,
        id,
        eventType,
        event_type,
        aggregateType,
        aggregate_type,
        aggregateId,
        aggregate_id,
        occurredOn,
        occurred_on,
        headers,
        ...domainFields
      } = parsed;

      payloadData = domainFields;
    }


    return {
      eventId:
        parsed.eventId ||
        parsed.id ||
        null,

      eventType:
        parsed.eventType ||
        parsed.event_type ||
        "UNKNOWN_EVENT",

      aggregateType:
        parsed.aggregateType ||
        parsed.aggregate_type ||
        "UNKNOWN",

      aggregateId:
        parsed.aggregateId !== undefined &&
        parsed.aggregateId !== null
          ? String(parsed.aggregateId)
          : (
              parsed.aggregate_id
                ? String(parsed.aggregate_id)
                : null
            ),

      occurredOn:
        parsed.occurredOn ||
        parsed.occurred_on ||
        new Date().toISOString(),

      headers:
        mergedHeaders,

      payload:
        payloadData ?? {},
    };
  }


  /**
   * Maps deserialized event to a domain event class instance.
   *
   * @param {Object} deserializedEnvelope
   * @param {Map<string, Function>|Object} [registry]
   * @returns {Object}
   */
  static toDomainInstance(
    deserializedEnvelope,
    registry
  ) {
    if (!registry) {
      return deserializedEnvelope;
    }


    const eventType =
      deserializedEnvelope.eventType;


    let EventClass;


    if (registry instanceof Map) {
      EventClass = registry.get(eventType);

    } else if (
      typeof registry === "object"
    ) {
      EventClass = registry[eventType];
    }


    if (!EventClass) {
      return deserializedEnvelope;
    }


    if (
      typeof EventClass.fromPrimitives === "function"
    ) {
      return EventClass.fromPrimitives(
        deserializedEnvelope.payload,
        deserializedEnvelope
      );
    }


    return new EventClass(
      deserializedEnvelope.payload
    );
  }
}