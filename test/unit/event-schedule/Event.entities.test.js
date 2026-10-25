
import { Event, EVENT_STATUS } from "../../../src/conference-management/event-schedule/domain/entities/event.js";

const future = (days, minutes = 0) =>
  new Date(Date.now() + days * 86400000 + minutes * 60000).toISOString();

const createEvent = (overrides = {}) =>
  Event.create({
    title: "Backend Engineering Conference",
    roomID: "room-123",
    organizerId: "organizer-456",
    startTime: future(2),
    endTime: future(2, 60),
    ...overrides,
  });

describe("Event aggregate", () => {
  test("creates a scheduled event and records EventScheduled", () => {
    const event = createEvent();
    const [recorded] = event.pullEvents();

    expect(event.id).toBeTruthy();
    expect(event.status).toBe(EVENT_STATUS.SCHEDULED);
    expect(event.version).toBe(0);
    expect(recorded.metadata.eventName).toBe("event.scheduled");
    expect(recorded.payload.eventId).toBe(event.id);
  });

  test("rejects invalid start dates", () => {
    expect(() => createEvent({ startTime: "invalid" }))
      .toThrow("Invalid startTime");
  });

  test("reschedules and increments the version", () => {
    const event = createEvent();
    event.pullEvents();

    event.reschedule(
      { startTime: future(3), endTime: future(3, 90) },
      { rescheduledBy: "organizer-456" },
    );

    const [recorded] = event.pullEvents();

    expect(event.version).toBe(1);
    expect(recorded.metadata.eventName).toBe("event.rescheduled");
    expect(recorded.payload.rescheduledBy).toBe("organizer-456");
  });

  test("rejects rescheduling without an actor and preserves state", () => {
    const event = createEvent();
    const originalStart = event.startTime;

    expect(() =>
      event.reschedule({
        startTime: future(3),
        endTime: future(3, 60),
      }),
    ).toThrow("rescheduledBy is required");

    expect(event.version).toBe(0);
    expect(event.startTime).toBe(originalStart);
  });

  test("cancels and increments the version", () => {
    const event = createEvent();
    event.pullEvents();

    event.cancel("Venue unavailable", {
      cancelledBy: "organizer-456",
    });

    const [recorded] = event.pullEvents();

    expect(event.status).toBe(EVENT_STATUS.CANCELLED);
    expect(event.version).toBe(1);
    expect(recorded.metadata.eventName).toBe("event.cancelled");
    expect(recorded.payload.cancelledBy).toBe("organizer-456");
  });

  test("rejects cancellation without an actor", () => {
    const event = createEvent();

    expect(() => event.cancel()).toThrow("cancelledBy is required");
    expect(event.status).toBe(EVENT_STATUS.SCHEDULED);
    expect(event.version).toBe(0);
  });

  test("rehydrates database snake_case fields", () => {
    const event = Event.fromPersistence({
      id: "event-123",
      title: "Persisted conference",
      room_id: "room-123",
      organizer_id: "organizer-456",
      start_time: future(2),
      end_time: future(2, 60),
      status: EVENT_STATUS.SCHEDULED,
      version: 3,
    });

    expect(event.id).toBe("event-123");
    expect(event.roomID).toBe("room-123");
    expect(event.organizerId).toBe("organizer-456");
    expect(event.version).toBe(3);
    expect(event.pullEvents()).toHaveLength(0);
  });

  test("returns null for a missing persistence record", () => {
    expect(Event.fromPersistence(null)).toBeNull();
  });
});
