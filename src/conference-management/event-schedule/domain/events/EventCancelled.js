
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
  }) {
    if (typeof eventId !== "string" || !eventId.trim()) {
      throw new DomainInvariantError(
        "EventCancelled: eventId is required.",
      );
    }

    if (typeof cancelledBy !== "string" || !cancelledBy.trim()) {
      throw new DomainInvariantError(
        "EventCancelled: cancelledBy is required.",
      );
    }

    const parsedOccurred =
      occurredAt instanceof Date ? new Date(occurredAt) : new Date(occurredAt);

    if (Number.isNaN(parsedOccurred.getTime())) {
      throw new DomainInvariantError(
        "EventCancelled: Invalid occurredAt timestamp.",
      );
    }

    const normalizedReason =
      typeof reason === "string" && reason.trim()
        ? reason.trim()
        : null;

    super({
      eventName: "event.cancelled",
      eventVersion: 1,
      aggregateId: eventId.trim(),
      occurredAt: parsedOccurred,
      correlationId,
      causationId,
    });

    this.payload = Object.freeze({
      eventId: eventId.trim(),
      cancelledBy: cancelledBy.trim(),
      reason: normalizedReason,
    });

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
    if (!json?.payload || typeof json.payload !== "object") {
      throw new DomainInvariantError(
        "EventCancelled: Cannot rehydrate from an invalid payload.",
      );
    }

    const metadata = json.metadata ?? {};
    const payload = json.payload;

    return new EventCancelled({
      eventId:
        json.aggregateId ??
        metadata.aggregateId ??
        payload.eventId,
      cancelledBy: payload.cancelledBy,
      reason: payload.reason,
      correlationId:
        json.correlationId ?? metadata.correlationId ?? null,
      causationId:
        json.causationId ?? metadata.causationId ?? null,
      occurredAt:
        json.occurredAt ??
        metadata.occurredAt ??
        new Date(),
    });
  }
}
