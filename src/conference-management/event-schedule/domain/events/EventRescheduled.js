import { DomainEvent } from "../../../../shared/domain/DomainEvent.js";
import { EventDeserializationError } from "../../../../shared/domain/error/DomainErrors.js";

export class EventRescheduled extends DomainEvent {
  constructor({
    eventId,
    previousStartTime,
    previousEndTime,
    newStartTime,
    newEndTime,
    rescheduledBy,
    reason = "user_request",
    occurredAt,
    correlationId = null,
    causationId = null,
    eventInstanceId,
  }) {
    if (typeof eventId !== "string" || !eventId.trim()) {
      throw new EventDeserializationError("EventRescheduled: eventId required.");
    }
    if (!previousStartTime) {
      throw new EventDeserializationError("EventRescheduled: previousStartTime required.");
    }
    if (!previousEndTime) {
      throw new EventDeserializationError("EventRescheduled: previousEndTime required.");
    }
    if (!newStartTime) {
      throw new EventDeserializationError("EventRescheduled: newStartTime required.");
    }
    if (!newEndTime) {
      throw new EventDeserializationError("EventRescheduled: newEndTime required.");
    }
    if (typeof rescheduledBy !== "string" || !rescheduledBy.trim()) {
      throw new EventDeserializationError("EventRescheduled: rescheduledBy required.");
    }
    if (!occurredAt) {
      throw new EventDeserializationError("EventRescheduled: occurredAt required.");
    }

    const pStart = new Date(previousStartTime);
    const pEnd = new Date(previousEndTime);
    const nStart = new Date(newStartTime);
    const nEnd = new Date(newEndTime);
    const parsedOccurred = new Date(occurredAt);

    if (Number.isNaN(pStart.getTime())) {
      throw new EventDeserializationError("EventRescheduled: Invalid previousStartTime");
    }
    if (Number.isNaN(pEnd.getTime())) {
      throw new EventDeserializationError("EventRescheduled: Invalid previousEndTime");
    }
    if (Number.isNaN(nStart.getTime())) {
      throw new EventDeserializationError("EventRescheduled: Invalid newStartTime");
    }
    if (Number.isNaN(nEnd.getTime())) {
      throw new EventDeserializationError("EventRescheduled: Invalid newEndTime");
    }
    if (Number.isNaN(parsedOccurred.getTime())) {
      throw new EventDeserializationError("EventRescheduled: Invalid occurredAt");
    }

    super({
      eventName: "event.rescheduled",
      eventVersion: 1,
      aggregateId: eventId.trim(),
      occurredAt: parsedOccurred,
      correlationId,
      causationId,
      ...(eventInstanceId ? { eventId: eventInstanceId } : {}),
    });

    this.payload = Object.freeze({
      eventId: eventId.trim(),
      previousStartTime: pStart.toISOString(),
      previousEndTime: pEnd.toISOString(),
      newStartTime: nStart.toISOString(),
      newEndTime: nEnd.toISOString(),
      rescheduledBy: rescheduledBy.trim(),
      reason,
    });

    this.freezeEvent();
  }

  static fromJSON(json) {
    if (!json?.payload || typeof json.payload !== "object" || Array.isArray(json.payload)) {
      throw new EventDeserializationError(
        "EventRescheduled: Cannot rehydrate from invalid payload.",
      );
    }

    const metadata = json.metadata ?? {};
    const payload = json.payload;
    const aggregateId =
      metadata.aggregateId ?? json.aggregateId ?? payload.eventId;
    const occurredAt = metadata.occurredAt ?? json.occurredAt;

    if (!payload.eventId || aggregateId !== payload.eventId) {
      throw new EventDeserializationError(
        "EventRescheduled: aggregateId mismatch during rehydration.",
      );
    }

    if (!occurredAt) {
      throw new EventDeserializationError(
        "EventRescheduled: occurredAt is required during rehydration.",
      );
    }

    return new EventRescheduled({
      eventId: payload.eventId,
      previousStartTime: payload.previousStartTime,
      previousEndTime: payload.previousEndTime,
      newStartTime: payload.newStartTime,
      newEndTime: payload.newEndTime,
      rescheduledBy: payload.rescheduledBy,
      reason: payload.reason,
      occurredAt,
      correlationId: metadata.correlationId ?? json.correlationId ?? null,
      causationId: metadata.causationId ?? json.causationId ?? null,
      eventInstanceId: metadata.eventId ?? json.eventId,
    });
  }
}
