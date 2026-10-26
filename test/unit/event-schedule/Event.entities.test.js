import { Event, EVENT_STATUS } from "../../../src/conference-management/event-schedule/domain/entities/event.js";

function futureTime(daysFromNow, minutes = 0) {
  return new Date(
    Date.now() +
      daysFromNow * 24 * 60 * 60 * 1000 +
      minutes * 60 * 1000,
  ).toISOString();
}

function createEvent(overrides = {}) {
  return Event.create({
    title: "Backend Engineering Conference",
    roomID: "room-123",
    organizerId: "organizer-456",
    startTime: futureTime(2),
    endTime: futureTime(2, 60),
    ...overrides,
  });
}

describe("Event aggregate", () => {
  describe("create()", () => {
    test("creates a scheduled event and records EventScheduled", () => {
      const event = createEvent();

      expect(event.id).toBeTruthy();
      expect(event.status).toBe(EVENT_STATUS.SCHEDULED);
      expect(event.version).toBe(0);
      expect(event.title).toBe("Backend Engineering Conference");

      const [domainEvent] = event.pullEvents();

      expect(domainEvent.metadata.eventName).toBe("event.scheduled");
      expect(domainEvent.metadata.aggregateId).toBe(event.id);
      expect(domainEvent.payload).toMatchObject({
        eventId: event.id,
        title: event.title,
        roomId: event.roomID,
      });
      expect(domainEvent.metadata.occurredAt).toBeTruthy();
    });

    test("rejects a missing title", () => {
      expect(() => createEvent({ title: " " })).toThrow(
        "Event title is required",
      );
    });

    test("rejects an invalid date", () => {
      expect(() => createEvent({ startTime: "not-a-date" })).toThrow(
        "Invalid startTime",
      );
    });

    test("rejects an end time before the start time", () => {
      expect(() =>
        createEvent({
          startTime: futureTime(4),
          endTime: futureTime(3),
        }),
      ).toThrow("Start must be before end");
    });
  });

  describe("reschedule()", () => {
    test("updates the schedule, increments version and records an event", () => {
      const event = createEvent();
      event.pullEvents();

      const previousStartTime = event.startTime;
      const previousEndTime = event.endTime;

      event.reschedule(
        {
          startTime: futureTime(3),
          endTime: futureTime(3, 90),
        },
        {
          rescheduledBy: "organizer-456",
          reason: "speaker availability",
          correlationId: "correlation-123",
        },
      );

      expect(event.version).toBe(1);
      expect(event.startTime).not.toBe(previousStartTime);
      expect(event.endTime).not.toBe(previousEndTime);

      const [domainEvent] = event.pullEvents();

      expect(domainEvent.metadata.eventName).toBe("event.rescheduled");
      expect(domainEvent.payload).toMatchObject({
        eventId: event.id,
        previousStartTime,
        previousEndTime,
        rescheduledBy: "organizer-456",
        reason: "speaker availability",
      });
    });

    test("rejects a missing rescheduling actor without changing state", () => {
      const event = createEvent();
      const originalStartTime = event.startTime;
      const originalEndTime = event.endTime;

      expect(() =>
        event.reschedule({
          startTime: futureTime(3),
          endTime: futureTime(3, 60),
        }),
      ).toThrow("rescheduledBy is required");

      expect(event.version).toBe(0);
      expect(event.startTime).toBe(originalStartTime);
      expect(event.endTime).toBe(originalEndTime);
    });
  });

  describe("cancel()", () => {
    test("cancels the event, increments version and records the actor", () => {
      const event = createEvent();
      event.pullEvents();

      event.cancel("Venue unavailable", {
        cancelledBy: "organizer-456",
        correlationId: "correlation-456",
      });

      expect(event.status).toBe(EVENT_STATUS.CANCELLED);
      expect(event.version).toBe(1);

      const [domainEvent] = event.pullEvents();

      expect(domainEvent.metadata.eventName).toBe("event.cancelled");
      expect(domainEvent.payload).toMatchObject({
        eventId: event.id,
        cancelledBy: "organizer-456",
        reason: "Venue unavailable",
      });
    });

    test("rejects a missing cancellation actor without changing state", () => {
      const event = createEvent();

      expect(() => event.cancel()).toThrow("cancelledBy is required");

      expect(event.status).toBe(EVENT_STATUS.SCHEDULED);
      expect(event.version).toBe(0);
    });

    test("rejects a second cancellation", () => {
      const event = createEvent();

      event.cancel("First cancellation", {
        cancelledBy: "organizer-456",
      });

      expect(() =>
        event.cancel("Second cancellation", {
          cancelledBy: "organizer-456",
        }),
      ).toThrow("Event is already cancelled");

      expect(event.version).toBe(1);
    });
  });

  describe("fromPersistence()", () => {
    test("rehydrates an event from database column names", () => {
      const startTime = futureTime(2);
      const endTime = futureTime(2, 60);

      const event = Event.fromPersistence({
        id: "event-123",
        title: "Persisted conference",
        room_id: "room-123",
        organizer_id: "organizer-456",
        start_time: startTime,
        end_time: endTime,
        status: EVENT_STATUS.SCHEDULED,
        version: 3,
      });

      expect(event.id).toBe("event-123");
      expect(event.roomID).toBe("room-123");
      expect(event.organizerId).toBe("organizer-456");
      expect(event.version).toBe(3);
      expect(event.startTime).toBe(new Date(startTime).toISOString());
      expect(event.pullEvents()).toHaveLength(0);
    });

    test("returns null for a missing database record", () => {
      expect(Event.fromPersistence(null)).toBeNull();
    });

    test("rejects invalid persisted dates", () => {
      expect(() =>
        Event.fromPersistence({
          id: "event-123",
          start_time: "invalid",
          end_time: futureTime(2),
          version: 0,
        }),
      ).toThrow("invalid start time");
    });
  });
});