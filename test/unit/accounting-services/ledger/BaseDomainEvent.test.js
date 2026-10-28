import { describe, expect, it } from "@jest/globals";

import { BaseDomainEvent } from "../../../../src/conference-management/accounting-services/ledger/domain/events/base-domain.event.js";
import { InvalidArgumentError } from "../../../../src/conference-management/accounting-services/ledger/domain/error/index.js";

const validInput = {
  eventName: "account.created",
  aggregateId: "account-123",
  payload: { accountId: "account-123", currency: "NGN" },
  metadata: { correlationId: "correlation-123" },
};

describe("BaseDomainEvent", () => {
  describe("construction", () => {
    it("creates an event with the expected values", () => {
      const occurredAt = new Date("2026-01-15T10:30:00.000Z");
      const event = new BaseDomainEvent({
        ...validInput,
        eventId: "event-123",
        version: 2,
        occurredAt,
      });

      expect(event.eventId).toBe("event-123");
      expect(event.eventName).toBe("account.created");
      expect(event.aggregateId).toBe("account-123");
      expect(event.version).toBe(2);
      expect(event.occurredAt).toBe(occurredAt);
      expect(event.payload).toEqual(validInput.payload);
      expect(event.metadata).toEqual(validInput.metadata);
    });

    it("generates an event ID when none is supplied", () => {
      const event = new BaseDomainEvent(validInput);

      expect(typeof event.eventId).toBe("string");
      expect(event.eventId.length).toBeGreaterThan(0);
    });

    it("defaults version, payload, metadata, and occurrence time", () => {
      const event = new BaseDomainEvent({
        eventName: validInput.eventName,
        aggregateId: validInput.aggregateId,
      });

      expect(event.version).toBe(1);
      expect(event.payload).toEqual({});
      expect(event.metadata).toEqual({});
      expect(event.occurredAt).toBeInstanceOf(Date);
      expect(Number.isNaN(event.occurredAt.getTime())).toBe(false);
    });
  });

  describe("validation", () => {
    it.each([
      ["missing eventName", { ...validInput, eventName: undefined }],
      ["empty eventName", { ...validInput, eventName: "" }],
      ["non-string eventName", { ...validInput, eventName: 123 }],
      ["missing aggregateId", { ...validInput, aggregateId: undefined }],
      ["empty aggregateId", { ...validInput, aggregateId: "" }],
      ["non-string aggregateId", { ...validInput, aggregateId: 123 }],
    ])("rejects %s", (_label, input) => {
      expect(() => new BaseDomainEvent(input)).toThrow(InvalidArgumentError);
    });

    it.each([0, -1, 1.5, NaN, "1", null])(
      "rejects invalid version %s",
      (version) => {
        expect(
          () => new BaseDomainEvent({ ...validInput, version }),
        ).toThrow(InvalidArgumentError);
      },
    );

    it.each(["not-a-date", "2026-02-30T25:61:00Z"])(
      "rejects invalid occurrence date %s",
      (occurredAt) => {
        expect(
          () => new BaseDomainEvent({ ...validInput, occurredAt }),
        ).toThrow(InvalidArgumentError);
      },
    );
  });

  describe("immutability", () => {
    it("freezes the event and its top-level payload and metadata", () => {
      const event = new BaseDomainEvent(validInput);

      expect(Object.isFrozen(event)).toBe(true);
      expect(Object.isFrozen(event.payload)).toBe(true);
      expect(Object.isFrozen(event.metadata)).toBe(true);
    });

    it("does not allow top-level payload or metadata properties to be changed", () => {
      const event = new BaseDomainEvent(validInput);

      expect(() => {
        event.payload.accountId = "changed";
      }).toThrow(TypeError);

      expect(() => {
        event.metadata.correlationId = "changed";
      }).toThrow(TypeError);
    });
  });

  describe("serialization", () => {
    it("serializes the event identity, timestamp, payload, and metadata", () => {
      const event = new BaseDomainEvent({
        ...validInput,
        eventId: "event-123",
        occurredAt: new Date("2026-01-15T10:30:00.000Z"),
      });

      expect(event.toJSON()).toEqual({
          eventId: "event-123",
          eventName: "account.created",
          aggregateId: "account-123",
          version: 1,
          occurredAt: "2026-01-15T10:30:00.000Z",
          payload: validInput.payload,
          metadata: validInput.metadata,
     });
    });
  });
});
