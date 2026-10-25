import { DomainEvent } from "../../../../Shared/domain/DomainEvent.js";
import { DomainInvariantError } from "../../../../Shared/domain/error/DomainErrors.js";

export class EventCancelled extends DomainEvent {
  constructor({
    eventId,
    cancelledBy,
    reason = null,
    correlationId = null,
    causationId = null,
    occurredAt = new Date(),
    eventInstanceId,
  }) {
    if (typeof eventId !== "string" || !eventId.trim()) {
      throw new DomainInvariantError("EventCancelled: eventId is required.");
    }

    if (typeof cancelledBy !== "string" || !cancelledBy.trim()) {
      throw new DomainInvariantError("EventCancelled: cancelledBy is required.");
    }

    const parsedOccurred =
      occurredAt instanceof Date ? new Date(occurredAt) : new Date(occurredAt);

    if (Number.isNaN(parsedOccurred.getTime())) {
      throw new DomainInvariantError(
        "EventCancelled: Invalid occurredAt timestamp.",
      );
    }

    const normalizedReason =
      typeof reason === "string" && reason.trim() ? reason.trim() : null;

    super({
      eventName: "event.cancelled",
      eventVersion: 1,
      aggregateId: eventId.trim(),
      occurredAt: parsedOccurred,
      correlationId,
      causationId,
      ...(eventInstanceId ? { eventId: eventInstanceId } : {}),
    });

    this.payload = {
      eventId: eventId.trim(),
      cancelledBy: cancelledBy.trim(),
      reason: normalizedReason,
    };

    this.freezeEvent();
  }

  toJSON() {
    return {
      eventName: this.metadata.eventName,
      version: this.metadata.eventVersion,
      metadata: this.metadata,
      payload: this.payload,
    };
  }

  static fromJSON(json) {
    if (
      !json?.payload ||
      typeof json.payload !== "object" ||
      Array.isArray(json.payload)
    ) {
      throw new DomainInvariantError(
        "EventCancelled: Cannot rehydrate from an invalid payload.",
      );
    }

    const metadata = json.metadata ?? {};
    const payload = json.payload;
    const aggregateId =
      metadata.aggregateId ?? json.aggregateId ?? payload.eventId;
    const occurredAt = metadata.occurredAt ?? json.occurredAt;

    if (
      typeof payload.eventId !== "string" ||
      !payload.eventId.trim() ||
      aggregateId !== payload.eventId
    ) {
      throw new DomainInvariantError(
        "EventCancelled: aggregateId mismatch during rehydration.",
      );
    }

    if (!occurredAt) {
      throw new DomainInvariantError(
        "EventCancelled: occurredAt is required during rehydration.",
      );
    }

    return new EventCancelled({
      eventId: payload.eventId,
      cancelledBy: payload.cancelledBy,
      reason: payload.reason,
      correlationId: metadata.correlationId ?? json.correlationId ?? null,
      causationId: metadata.causationId ?? json.causationId ?? null,
      occurredAt,
      eventInstanceId: metadata.eventId ?? json.eventId,
    });
  }
}
