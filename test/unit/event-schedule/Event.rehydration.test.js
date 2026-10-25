import { EventCancelled } from "../../../src/conference-management/event-schedule/domain/events/EventCancelled.js";
import { EventRescheduled } from "../../../src/conference-management/event-schedule/domain/events/EventRescheduled.js";

describe("EventCancelled rehydration", () => {
  const occurredAt = "2026-10-25T10:00:00.000Z";

  function createEvent() {
    return new EventCancelled({
      eventId: "event-123",
      cancelledBy: "organizer-123",
      reason: "Venue unavailable",
      occurredAt,
      correlationId: "correlation-123",
      causationId: "causation-123",
    });
  }

  test("preserves event metadata and payload during JSON round-trip", () => {
    const original = createEvent();
    const restored = EventCancelled.fromJSON(JSON.parse(JSON.stringify(original)));

    expect(restored.metadata.eventId).toBe(original.metadata.eventId);
    expect(restored.metadata.aggregateId).toBe(original.metadata.aggregateId);
    expect(restored.metadata.occurredAt).toBe(original.metadata.occurredAt);
    expect(restored.metadata.correlationId).toBe(original.metadata.correlationId);
    expect(restored.metadata.causationId).toBe(original.metadata.causationId);
    expect(restored.payload).toEqual(original.payload);
  });

  test("rejects an aggregate ID that conflicts with the payload event ID", () => {
    const original = createEvent();
    const serialized = JSON.parse(JSON.stringify(original));
    serialized.metadata = {
      ...serialized.metadata,
      aggregateId: "different-event",
    };

    expect(() => EventCancelled.fromJSON(serialized)).toThrow();
  });

  test("rejects a missing historical occurredAt timestamp", () => {
    const serialized = JSON.parse(JSON.stringify(createEvent()));
    delete serialized.metadata.occurredAt;

    expect(() => EventCancelled.fromJSON(serialized)).toThrow();
  });

  test("rejects a missing payload", () => {
    expect(() => EventCancelled.fromJSON({ metadata: {} })).toThrow();
  });
});

describe("EventRescheduled rehydration", () => {
  const occurredAt = "2026-10-25T10:00:00.000Z";

  function createEvent() {
    return new EventRescheduled({
      eventId: "event-456",
      previousStartTime: "2026-10-26T09:00:00.000Z",
      previousEndTime: "2026-10-26T10:00:00.000Z",
      newStartTime: "2026-10-27T09:00:00.000Z",
      newEndTime: "2026-10-27T10:00:00.000Z",
      rescheduledBy: "organizer-456",
      reason: "Venue change",
      occurredAt,
      correlationId: "correlation-456",
      causationId: "causation-456",
    });
  }

  test("preserves event metadata and payload during JSON round-trip", () => {
    const original = createEvent();
    const serialized = {
      metadata: original.metadata,
      payload: original.payload,
    };
    const restored = EventRescheduled.fromJSON(serialized);

    expect(restored.metadata.eventId).toBe(original.metadata.eventId);
    expect(restored.metadata.aggregateId).toBe(original.metadata.aggregateId);
    expect(restored.metadata.occurredAt).toBe(original.metadata.occurredAt);
    expect(restored.metadata.correlationId).toBe(original.metadata.correlationId);
    expect(restored.metadata.causationId).toBe(original.metadata.causationId);
    expect(restored.payload).toEqual(original.payload);
  });

  test("rejects an aggregate ID that conflicts with the payload event ID", () => {
    const original = createEvent();

    expect(() =>
      EventRescheduled.fromJSON({
        metadata: {
          ...original.metadata,
          aggregateId: "different-event",
        },
        payload: original.payload,
      })
    ).toThrow();
  });

  test("rejects a missing historical occurredAt timestamp", () => {
    const original = createEvent();
    const metadata = { ...original.metadata };
    delete metadata.occurredAt;

    expect(() =>
      EventRescheduled.fromJSON({
        metadata,
        payload: original.payload,
      })
    ).toThrow();
  });

  test("rejects a missing payload", () => {
    expect(() => EventRescheduled.fromJSON({ metadata: {} })).toThrow();
  });
});
