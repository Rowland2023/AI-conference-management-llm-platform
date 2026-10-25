
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
    id = randomUUID(),
    title,
    roomID,
    organizerId,
    startTime,
    endTime,
    status = EVENT_STATUS.DRAFT,
    version = 0,
  }) {
    // Entity owns ID and version management.
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
    if (!title?.trim()) {
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
    const now = new Date();

    if (Number.isNaN(parsedStart.getTime())) {
      throw new DomainInvariantError("Invalid startTime.");
    }

    if (Number.isNaN(parsedEnd.getTime())) {
      throw new DomainInvariantError("Invalid endTime.");
    }

    if (parsedStart >= parsedEnd) {
      throw new DomainInvariantError("Start must be before end.");
    }

    if (parsedStart <= now) {
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
        organizerId: event.organizerId,
        startTime: event.startTime,
        endTime: event.endTime,
        occurredAt: new Date().toISOString(),
        correlationId,
      }),
    );

    return event;
  }

  static fromPersistence(dbDoc) {
    if (!dbDoc) {
      return null;
    }

    // Support database snake_case and domain camelCase fields.
    const id = dbDoc.id;
    const roomID = dbDoc.roomID ?? dbDoc.room_id;
    const organizerId = dbDoc.organizerId ?? dbDoc.organizer_id;
    const startTime = dbDoc.startTime ?? dbDoc.start_time;
    const endTime = dbDoc.endTime ?? dbDoc.end_time;

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      throw new DomainInvariantError(
        `Corrupt event ${id}: invalid start or end time.`,
      );
    }

    if (start >= end) {
      throw new DomainInvariantError(
        `Corrupt event ${id}: start time must be before end time.`,
      );
    }

    const event = new Event({
      id,
      title: dbDoc.title,
      roomID,
      organizerId,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      status: dbDoc.status,
      version: dbDoc.version ?? 0,
    });

    // Rehydrating persisted state must not emit new domain events.
    event.pullEvents();

    return event;
  }

  cancel(
    reason = null,
    {
      cancelledBy,
      correlationId = null,
      causationId = null,
    } = {},
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

    // Validate before mutating state.
    const event = new EventCancelled({
      eventId: this.id,
      cancelledBy,
      reason: reason || "Administrative cancellation",
      correlationId,
      causationId,
    });

    this.status = EVENT_STATUS.CANCELLED;
    this.incrementVersion();
    this.recordEvent(event);
  }

  reschedule(
    { startTime, endTime },
    {
      rescheduledBy,
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

    const parsedNewStart = new Date(startTime);
    const parsedNewEnd = new Date(endTime);
    const now = new Date();

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

    if (parsedNewStart <= now) {
      throw new DomainInvariantError(
        "Cannot reschedule an event into the past.",
      );
    }

    const previousStartTime = this.startTime;
    const previousEndTime = this.endTime;
    const newStartTime = parsedNewStart.toISOString();
    const newEndTime = parsedNewEnd.toISOString();

    // Build the event before changing aggregate state.
    const event = new EventRescheduled({
      eventId: this.id,
      previousStartTime,
      previousEndTime,
      newStartTime,
      newEndTime,
      rescheduledBy,
    occurredAt: new Date().toISOString(),
      correlationId,
      causationId,
    });

    this.startTime = newStartTime;
    this.endTime = newEndTime;
    this.incrementVersion();
    this.recordEvent(event);
  }
}
