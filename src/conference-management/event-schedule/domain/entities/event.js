
import { randomUUID } from "node:crypto";
import { Entity } from "../../../../Shared/domain/Entity.js";
import { DomainInvariantError } from "../../../../Shared/domain/error/DomainErrors.js";
import { EventScheduled } from "../events/EventScheduled.js";
import { EventCancelled } from "../events/EventCancelled.js";
import { EventRescheduled } from "../events/EventRescheduled.js";

export const EVENT_STATUS = Object.freeze({
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "InProgress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
});

export class Event extends Entity {
  constructor({
    id,
    title,
    roomID,
    organizerId,
    startTime,
    endTime,
    status = EVENT_STATUS.DRAFT,
    version = 0,
  }) {
    super(id, version);
    this.title = title;
    this.roomID = roomID;
    this.organizerId = organizerId;
    this.startTime = startTime;
    this.endTime = endTime;
    this.status = status;
  }

  static create(
    { title, roomID, organizerId, startTime, endTime },
    { correlationId = null, id = randomUUID() } = {},
  ) {
    if (typeof title !== "string" || !title.trim()) {
      throw new DomainInvariantError("Event title is required.");
    }

    if (!roomID) {
      throw new DomainInvariantError("Room ID is required.");
    }

    if (!organizerId) {
      throw new DomainInvariantError("Organizer ID is required.");
    }

    const parsedStart = new Date(startTime);
    const parsedEnd = new Date(endTime);

    if (Number.isNaN(parsedStart.getTime())) {
      throw new DomainInvariantError("Invalid startTime.");
    }

    if (Number.isNaN(parsedEnd.getTime())) {
      throw new DomainInvariantError("Invalid endTime.");
    }

    if (parsedStart >= parsedEnd) {
      throw new DomainInvariantError("Start must be before end.");
    }

    if (parsedStart <= new Date()) {
      throw new DomainInvariantError("Cannot schedule in the past.");
    }

    const event = new Event({
      id,
      title: title.trim(),
      roomID,
      organizerId,
      startTime: parsedStart.toISOString(),
      endTime: parsedEnd.toISOString(),
      status: EVENT_STATUS.SCHEDULED,
      version: 0,
    });

    event.recordEvent(
      new EventScheduled({
        eventId: event.id,
        title: event.title,
        roomId: event.roomID,
        startTime: event.startTime,
        endTime: event.endTime,
        occurredAt: new Date(),
        correlationId,
      }),
    );

    return event;
  }

  static fromPersistence(dbDoc) {
    if (!dbDoc) return null;

    const { id, title, status } = dbDoc;

    const roomID = dbDoc.roomID ?? dbDoc.room_id;
    const organizerId = dbDoc.organizerId ?? dbDoc.organizer_id;
    const rawStart = dbDoc.startTime ?? dbDoc.start_time;
    const rawEnd = dbDoc.endTime ?? dbDoc.end_time;
    const version = dbDoc.version ?? 0;

    if (typeof rawStart !== "string" && !(rawStart instanceof Date)) {
      throw new DomainInvariantError(
        `Corrupt event ${id}: invalid start time.`,
      );
    }

    if (typeof rawEnd !== "string" && !(rawEnd instanceof Date)) {
      throw new DomainInvariantError(
        `Corrupt event ${id}: invalid end time.`,
      );
    }

    const start = new Date(rawStart);
    const end = new Date(rawEnd);

    if (Number.isNaN(start.getTime())) {
      throw new DomainInvariantError(
        `Corrupt event ${id}: invalid start time.`,
      );
    }

    if (Number.isNaN(end.getTime())) {
      throw new DomainInvariantError(
        `Corrupt event ${id}: invalid end time.`,
      );
    }

    if (start >= end) {
      throw new DomainInvariantError(
        `Corrupt event ${id}: start time cannot be equal to or after end time.`,
      );
    }

    if (!Number.isInteger(version) || version < 0) {
      throw new DomainInvariantError(
        `Corrupt event ${id}: invalid version.`,
      );
    }

    return new Event({
      id,
      title,
      roomID,
      organizerId,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      status,
      version,
    });
  }

  cancel(
    reason = null,
    { cancelledBy, correlationId = null, causationId = null } = {},
  ) {
    if (this.status === EVENT_STATUS.CANCELLED) {
      throw new DomainInvariantError("Event is already cancelled.");
    }

    if (new Date(this.startTime) <= new Date()) {
      throw new DomainInvariantError(
        "Cannot cancel past or in-progress events.",
      );
    }

    if (!cancelledBy) {
      throw new DomainInvariantError(
        "cancelledBy is required for audit.",
      );
    }

    const cancelledEvent = new EventCancelled({
      eventId: this.id,
      cancelledBy,
      reason: reason || "Administrative cancellation",
      occurredAt: new Date(),
      correlationId,
      causationId,
    });

    this.status = EVENT_STATUS.CANCELLED;
    this.incrementVersion();
    this.recordEvent(cancelledEvent);

    return this;
  }

  reschedule(
    { startTime, endTime },
    {
      rescheduledBy,
      reason = "user_request",
      correlationId = null,
      causationId = null,
    } = {},
  ) {
    if (this.status === EVENT_STATUS.CANCELLED) {
      throw new DomainInvariantError(
        "Cannot reschedule a cancelled event.",
      );
    }

    if (!rescheduledBy) {
      throw new DomainInvariantError(
        "rescheduledBy is required for audit.",
      );
    }

    const previousStartTime = this.startTime;
    const previousEndTime = this.endTime;

    const parsedNewStart = new Date(startTime);
    const parsedNewEnd = new Date(endTime);

    if (Number.isNaN(parsedNewStart.getTime())) {
      throw new DomainInvariantError("Invalid new startTime.");
    }

    if (Number.isNaN(parsedNewEnd.getTime())) {
      throw new DomainInvariantError("Invalid new endTime.");
    }

    if (parsedNewStart >= parsedNewEnd) {
      throw new DomainInvariantError(
        "New startTime must be before new endTime.",
      );
    }

    if (parsedNewStart <= new Date()) {
      throw new DomainInvariantError(
        "Cannot reschedule an event into the past.",
      );
    }

    const newStartTime = parsedNewStart.toISOString();
    const newEndTime = parsedNewEnd.toISOString();

    const rescheduledEvent = new EventRescheduled({
  eventId: this.id,
  previousStartTime,
  previousEndTime,
  newStartTime,
  newEndTime,
  rescheduledBy,
  reason,
  occurredAt: new Date().toISOString(),
  correlationId,
  causationId,
});

    this.startTime = newStartTime;
    this.endTime = newEndTime;
    this.incrementVersion();
    this.recordEvent(rescheduledEvent);

    return this;
  }
}
