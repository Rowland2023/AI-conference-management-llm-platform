/**
 * @file src/Shared/infrastructure/messaging/serialization/event.serializer.js
 * @description Transforms domain events into standardized wire formats with full tracing metadata.
 */

import crypto from "node:crypto";
import RequestContext from "../../../cross-cutting/request-context.js";

export class EventSerializer {
  /**
   * Safely formats date input to ISO 8601 string with fallback to current timestamp.
   *
   * @private
   */
  static _toValidISOString(dateVal) {
    if (!dateVal) {
      return new Date().toISOString();
    }

    try {
      const parsed = new Date(dateVal);

      return isNaN(parsed.getTime())
        ? new Date().toISOString()
        : parsed.toISOString();

    } catch {
      return new Date().toISOString();
    }
  }


  /**
   * Serializes a domain event object or aggregate into a standardized message wire envelope.
   *
   * @param {Object} params
   * @param {Object} params.event
   * @param {Object} [params.customHeaders={}]
   * @returns {Object}
   */
  static serialize({
    event,
    customHeaders = {},
  }) {
    if (!event || typeof event !== "object") {
      throw new Error(
        "[EventSerializer] Cannot serialize null, undefined, or non-object event."
      );
    }


    const eventType =
      event.eventType ||
      event.constructor?.name;


    if (!eventType || eventType === "Object") {
      throw new Error(
        "[EventSerializer] Event must specify a valid eventType or class name."
      );
    }


    // Capture request tracing context
    const currentContext =
      RequestContext.getAll?.() || {};


    const headers = {
      "x-correlation-id":
        currentContext.correlationId ||
        customHeaders["x-correlation-id"] ||
        null,

      "x-tenant-id":
        currentContext.tenantId ||
        customHeaders["x-tenant-id"] ||
        null,

      "x-user-id":
        currentContext.userId ||
        customHeaders["x-user-id"] ||
        null,

      "x-serialized-at":
        new Date().toISOString(),

      ...customHeaders,
    };


    let dataPayload;


    if (
      typeof event.toPrimitives === "function"
    ) {
      dataPayload =
        event.toPrimitives();

    } else if (
      event.payload !== undefined
    ) {
      dataPayload =
        event.payload;

    } else {
      const {
        id,
        eventId,
        eventType: _eventType,
        aggregateType: _aggregateType,
        aggregateId: _aggregateId,
        occurredOn: _occurredOn,
        headers: _headers,
        ...rest
      } = event;


      dataPayload = rest;
    }


    return {
      eventId:
        event.id ||
        event.eventId ||
        crypto.randomUUID(),

      eventType,

      aggregateType:
        event.aggregateType ||
        "UNKNOWN",

      aggregateId:
        event.aggregateId !== undefined &&
        event.aggregateId !== null
          ? String(event.aggregateId)
          : null,

      occurredOn:
        EventSerializer._toValidISOString(
          event.occurredOn
        ),

      headers,

      payload:
        dataPayload ?? {},
    };
  }


  /**
   * Stringifies serialized event envelope for Kafka transport or Outbox storage.
   *
   * @param {Object} options
   * @returns {string}
   */
  static serializeToJSON(options) {
    const envelope =
      EventSerializer.serialize(options);

    return JSON.stringify(envelope);
  }
}