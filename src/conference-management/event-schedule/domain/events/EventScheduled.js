
import { DomainEvent } from "../../../../Shared/domain/DomainEvent.js";
import { DomainInvariantError } from "../../../../Shared/domain/error/DomainErrors.js";

const MAX_EVENT_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const ISO_UTC_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

export class EventScheduled extends DomainEvent {
  constructor({
    eventId,
    title,
    roomId,
    startTime,
    endTime,
    occurredAt,
    correlationId = null,
    causationId = null,
    eventInstanceId,
  }) {
    if (typeof eventId !== "string" || !eventId.trim()) {
      throw new DomainInvariantError(
        "EventScheduled: eventId is required.",
      );
    }

    if (typeof title !== "string" || !title.trim()) {
      throw new DomainInvariantError(
        "EventScheduled: title is required.",
      );
    }

    if (typeof roomId !== "string" || !roomId.trim()) {
      throw new DomainInvariantError(
        "EventScheduled: roomId is required.",
      );
    }

    if (!startTime) {
      throw new DomainInvariantError(
        "EventScheduled: startTime is required.",
      );
    }

    if (!endTime) {
      throw new DomainInvariantError(
        "EventScheduled: endTime is required.",
      );
    }

    if (occurredAt == null) {
      throw new DomainInvariantError(
        "EventScheduled: occurredAt is required.",
      );
    }

    if (
      typeof startTime !== "string" ||
      !ISO_UTC_REGEX.test(startTime)
    ) {
      throw new DomainInvariantError(
        "EventScheduled: startTime must be ISO-8601 UTC, e.g. 2026-08-01T09:00:00Z.",
      );
    }

    if (
      typeof endTime !== "string" ||
      !ISO_UTC_REGEX.test(endTime)
    ) {
      throw new DomainInvariantError(
        "EventScheduled: endTime must be ISO-8601 UTC.",
      );
    }

    const parsedStart = new Date(startTime);
    const parsedEnd = new Date(endTime);
    const parsedOccurred =
      occurredAt instanceof Date
        ? new Date(occurredAt.getTime())
        : new Date(occurredAt);

    if (
      Number.isNaN(parsedStart.getTime()) ||
      parsedStart.toISOString() !== startTime
    ) {
      throw new DomainInvariantError(
        "EventScheduled: invalid startTime.",
      );
    }

    if (
      Number.isNaN(parsedEnd.getTime()) ||
      parsedEnd.toISOString() !== endTime
    ) {
      throw new DomainInvariantError(
        "EventScheduled: invalid endTime.",
      );
    }

    if (Number.isNaN(parsedOccurred.getTime())) {
      throw new DomainInvariantError(
        "EventScheduled: invalid occurredAt.",
      );
    }

    if (parsedStart >= parsedEnd) {
      throw new DomainInvariantError(
        "EventScheduled: startTime must be before endTime.",
      );
    }

    const duration = parsedEnd.getTime() - parsedStart.getTime();

    if (duration > MAX_EVENT_DURATION_MS) {
      throw new DomainInvariantError(
        `EventScheduled: duration exceeds max ${MAX_EVENT_DURATION_MS}ms.`,
      );
    }

    super({
      eventName: "event.scheduled",
      eventVersion: 1,
      aggregateId: eventId.trim(),
      occurredAt: parsedOccurred,
      correlationId,
      causationId,
      ...(eventInstanceId ? { eventId: eventInstanceId } : {}),
    });

    this.payload = Object.freeze({
      eventId: eventId.trim(),
      title: title.trim(),
      roomId: roomId.trim(),
      startTime: parsedStart.toISOString(),
      endTime: parsedEnd.toISOString(),
    });

    this.freezeEvent();
  }

  static from(persisted) {
    if (
      !persisted?.payload ||
      typeof persisted.payload !== "object" ||
      Array.isArray(persisted.payload)
    ) {
      throw new DomainInvariantError(
        "EventScheduled: Cannot rehydrate from invalid data.",
      );
    }

    const metadata = persisted.metadata ?? {};
    const payload = persisted.payload;
    const aggregateId =
      metadata.aggregateId ??
      persisted.aggregateId ??
      payload.eventId;

    if (
      typeof payload.eventId !== "string" ||
      !payload.eventId.trim() ||
      typeof aggregateId !== "string" ||
      aggregateId.trim() !== payload.eventId.trim()
    ) {
      throw new DomainInvariantError(
        "EventScheduled: aggregateId mismatch during rehydration.",
      );
    }

    if (metadata.occurredAt == null) {
      throw new DomainInvariantError(
        "EventScheduled: occurredAt is required during rehydration.",
      );
    }

    return new EventScheduled({
      eventId: payload.eventId,
      title: payload.title,
      roomId: payload.roomId,
      startTime: payload.startTime,
      endTime: payload.endTime,
      occurredAt: metadata.occurredAt,
      correlationId: metadata.correlationId ?? null,
      causationId: metadata.causationId ?? null,
      eventInstanceId: metadata.eventId,
    });
  }
}
