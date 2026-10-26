
import { EventScheduled } from "../../../src/conference-management/event-schedule/domain/events/EventScheduled.js";

describe("EventScheduled metadata", () => {
  test("preserves event-instance ID and aggregate ID during rehydration", () => {
    const occurredAt = "2026-10-25T10:00:00.000Z";

    const original = new EventScheduled({
      eventId: "aggregate-123",
      title: "Backend Engineering Conference",
      roomId: "room-123",
      startTime: "2026-10-26T09:00:00.000Z",
      endTime: "2026-10-26T10:00:00.000Z",
      occurredAt,
      correlationId: "correlation-123",
      causationId: "causation-123",
    });

    const restored = EventScheduled.from({
      metadata: original.metadata,
      payload: original.payload,
    });

    expect(restored.metadata.eventId).toBe(original.metadata.eventId);
    expect(restored.metadata.aggregateId).toBe("aggregate-123");
    expect(restored.metadata.occurredAt).toBe(occurredAt);
    expect(restored.metadata.correlationId).toBe("correlation-123");
    expect(restored.metadata.causationId).toBe("causation-123");
    expect(restored.payload).toEqual(original.payload);
  });
});
