
import { EventSchedulingService } from "../../../src/conference-management/event-schedule/domain/service/Eventscheduling.service.js";
import { DomainInvariantError } from "../../../src/Shared/domain/error/DomainErrors.js";

describe("EventSchedulingService", () => {
  let eventRepository;
  let service;

  const futureStart = "2035-06-10T10:00:00.000Z";
  const futureEnd = "2035-06-10T11:00:00.000Z";

  beforeEach(() => {
    eventRepository = {
      existsOverlappingEvent: jest.fn().mockResolvedValue(false),
    };

    service = new EventSchedulingService({ eventRepository });
  });

  test("checks availability using positional repository arguments", async () => {
    await service.ensureCanSchedule({
      roomId: " room-123 ",
      startTime: futureStart,
      endTime: futureEnd,
    });

    expect(eventRepository.existsOverlappingEvent).toHaveBeenCalledWith(
      "room-123",
      futureStart,
      futureEnd,
      null,
      null
    );
  });

  test("rejects scheduling when the room is already occupied", async () => {
    eventRepository.existsOverlappingEvent.mockResolvedValue(true);

    await expect(
      service.ensureCanSchedule({
        roomId: "room-123",
        startTime: futureStart,
        endTime: futureEnd,
      })
    ).rejects.toThrow(DomainInvariantError);
  });

  test("excludes the current event when checking a reschedule", async () => {
    const event = {
      id: "event-123",
      roomID: "room-123",
    };

    await service.ensureCanReschedule(event, futureStart, futureEnd);

    expect(eventRepository.existsOverlappingEvent).toHaveBeenCalledWith(
      "room-123",
      futureStart,
      futureEnd,
      "event-123",
      null
    );
  });

  test("rejects rescheduling when another event overlaps", async () => {
    eventRepository.existsOverlappingEvent.mockResolvedValue(true);

    await expect(
      service.ensureCanReschedule(
        { id: "event-123", roomID: "room-123" },
        futureStart,
        futureEnd
      )
    ).rejects.toThrow(DomainInvariantError);
  });

  test("rejects a missing room identifier", async () => {
    await expect(
      service.ensureCanSchedule({
        roomId: " ",
        startTime: futureStart,
        endTime: futureEnd,
      })
    ).rejects.toThrow(DomainInvariantError);
  });

  test("rejects an invalid time window", async () => {
    await expect(
      service.ensureCanSchedule({
        roomId: "room-123",
        startTime: futureEnd,
        endTime: futureStart,
      })
    ).rejects.toThrow(DomainInvariantError);
  });

  test("rejects an event that ends in the past", async () => {
    await expect(
      service.ensureCanSchedule({
        roomId: "room-123",
        startTime: "2020-01-01T10:00:00.000Z",
        endTime: "2020-01-01T11:00:00.000Z",
      })
    ).rejects.toThrow(DomainInvariantError);
  });
});
