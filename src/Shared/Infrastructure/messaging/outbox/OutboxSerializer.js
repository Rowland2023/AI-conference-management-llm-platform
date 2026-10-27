/**
 * @file src/Shared/infrastructure/outbox/OutboxSerializer.js
 * @description Transforms Domain Event entities into persisted Outbox database records
 *              and deserializes them back for Outbox Relay dispatching.
 */

import { randomUUID } from "node:crypto";
import RequestContext from "../../../cross-cutting/context/request-context.js";

export class OutboxSerializer {
  /**
   * Serializes a Domain Event into a flat database payload ready for SQL insertion.
   *
   * @param {Object} params
   * @param {Object} params.event
   * @param {Object} [params.customHeaders]
   * @param {boolean} [params.stringifyJson=false]
   * @returns {Object}
   */
  static serialize({
    event,
    customHeaders = {},
    stringifyJson = false,
  }) {
    if (!event) {
      throw new Error(
        "[OutboxSerializer] Cannot serialize undefined or null event."
      );
    }

    const eventType =
      event.eventType ||
      event.constructor?.name;

    if (!eventType || eventType === "Object") {
      throw new Error(
        "[OutboxSerializer] Event must provide an explicit eventType or named constructor."
      );
    }

    const currentContext =
      RequestContext.getAll?.() || {};


    const mergedHeaders = {
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
    };


    for (const [key, value] of Object.entries(customHeaders)) {
      if (value !== undefined) {
        mergedHeaders[key] = value;
      }
    }


    const rawPayload =
      typeof event.toPrimitives === "function"
        ? event.toPrimitives()
        : (event.payload || event);


    const payload =
      stringifyJson &&
      typeof rawPayload !== "string"
        ? JSON.stringify(rawPayload)
        : rawPayload;


    const headers =
      stringifyJson
        ? JSON.stringify(mergedHeaders)
        : mergedHeaders;


    const aggregateId =
      event.aggregateId ||
      event.id ||
      null;


    return {
      id:
        event.id ||
        event.eventId ||
        randomUUID(),

      aggregate_type:
        event.aggregateType ||
        "UNKNOWN",

      aggregate_id:
        aggregateId
          ? String(aggregateId)
          : null,

      event_type:
        eventType,

      payload,

      headers,

      status:
        "PENDING",

      retry_count:
        0,

      occurred_on:
        event.occurredOn
          ? new Date(event.occurredOn).toISOString()
          : new Date().toISOString(),

      created_at:
        new Date().toISOString(),
    };
  }


  /**
   * Converts persisted outbox record into dispatch envelope.
   *
   * @param {Object} record
   * @returns {Object}
   */
  static deserialize(record) {
    if (!record) {
      throw new Error(
        "[OutboxSerializer] Cannot deserialize empty record."
      );
    }


    let parsedPayload = record.payload;

    if (typeof record.payload === "string") {
      try {
        parsedPayload = JSON.parse(record.payload);
      } catch {
        parsedPayload = record.payload;
      }
    }


    let parsedHeaders = {};

    if (typeof record.headers === "string") {
      try {
        parsedHeaders = JSON.parse(record.headers);
      } catch {
        parsedHeaders = {};
      }
    } else if (
      record.headers &&
      typeof record.headers === "object"
    ) {
      parsedHeaders = record.headers;
    }


    const occurredOn =
      record.occurred_on instanceof Date
        ? record.occurred_on.toISOString()
        : (
            record.occurred_on ||
            new Date().toISOString()
          );


    return {
      id: record.id,

      topic:
        record.event_type,

      aggregateId:
        record.aggregate_id,

      aggregateType:
        record.aggregate_type,

      headers:
        parsedHeaders,

      payload: {
        eventId:
          record.id,

        eventType:
          record.event_type,

        aggregateId:
          record.aggregate_id,

        occurredOn,

        data:
          parsedPayload,
      },
    };
  }
}