import { describe, expect, it } from "@jest/globals";

import { AccountReleasedEvent } from "../../../../src/conference-management/accounting-services/ledger/domain/events/account-released.event.js";
import { InvalidArgumentError } from "../../../../src/conference-management/accounting-services/ledger/domain/error/index.js";

const validInput = {
  accountId: "account-123",
  holdId: "hold-456",
  releasedAmount: "12500",
};

describe("AccountReleasedEvent", () => {
  describe("construction", () => {
    it("creates an event with the expected identity and payload", () => {
      const event = new AccountReleasedEvent(validInput);

      expect(event.eventName).toBe("account.released");
      expect(event.aggregateId).toBe("account-123");
      expect(event.version).toBe(1);
      expect(event.eventId).toBeTruthy();
      expect(event.payload).toEqual({
        accountId: "account-123",
        holdId: "hold-456",
        releasedAmount: "12500",
        reason: "Hold released",
      });
    });

    it("preserves an explicitly supplied event ID and occurrence time", () => {
      const occurredAt = new Date("2026-01-15T10:30:00.000Z");

      const event = new AccountReleasedEvent({
        ...validInput,
        eventId: "event-123",
        occurredAt,
      });

      expect(event.eventId).toBe("event-123");
      expect(event.occurredAt).toBe(occurredAt);
    });

    it("generates an event ID when none is supplied", () => {
      const event = new AccountReleasedEvent(validInput);

      expect(typeof event.eventId).toBe("string");
      expect(event.eventId.length).toBeGreaterThan(0);
    });

    it("trims a custom release reason", () => {
      const event = new AccountReleasedEvent({
        ...validInput,
        reason: "  Partial release  ",
      });

      expect(event.payload.reason).toBe("Partial release");
    });

    it.each([
      ["", "Hold released"],
      ["   ", "Hold released"],
      [null, "Hold released"],
      [undefined, "Hold released"],
      [123, "Hold released"],
    ])("uses the default reason for %s", (reason, expected) => {
      const event = new AccountReleasedEvent({
        ...validInput,
        reason,
      });

      expect(event.payload.reason).toBe(expected);
    });

    it("preserves metadata and serializes the event to JSON", () => {
      const occurredAt = new Date("2026-01-15T10:30:00.000Z");
      const metadata = {
        correlationId: "correlation-123",
        source: "ledger",
      };

      const event = new AccountReleasedEvent({
        ...validInput,
        occurredAt,
        metadata,
        reason: "Customer request",
      });

      expect(event.metadata).toEqual(metadata);
      expect(event.toJSON()).toEqual({
        eventId: event.eventId,
        eventName: "account.released",
        aggregateId: "account-123",
        version: 1,
        occurredAt: "2026-01-15T10:30:00.000Z",
        payload: {
          accountId: "account-123",
          holdId: "hold-456",
          releasedAmount: "12500",
          reason: "Customer request",
        },
        metadata,
      });
    });

    it("preserves large amounts without losing integer precision", () => {
      const event = new AccountReleasedEvent({
        ...validInput,
        releasedAmount: "900719925474099312345",
      });

      expect(event.payload.releasedAmount).toBe("900719925474099312345");
    });

    it("accepts a positive BigInt amount", () => {
      const event = new AccountReleasedEvent({
        ...validInput,
        releasedAmount: 9007199254740993n,
      });

      expect(event.payload.releasedAmount).toBe("9007199254740993");
    });
  });

  describe("required identifiers", () => {
    it.each([
      ["accountId", undefined],
      ["accountId", ""],
      ["accountId", "   "],
      ["accountId", null],
      ["accountId", 123],
      ["holdId", undefined],
      ["holdId", ""],
      ["holdId", "   "],
      ["holdId", null],
      ["holdId", 123],
    ])("rejects invalid %s value %s", (field, value) => {
      expect(
        () =>
          new AccountReleasedEvent({
            ...validInput,
            [field]: value,
          }),
      ).toThrow(InvalidArgumentError);
    });
  });

  describe("released amount validation", () => {
    it.each([
      ["zero string", "0"],
      ["negative string", "-1"],
      ["zero number", 0],
      ["negative number", -100],
      ["null", null],
      ["undefined", undefined],
      ["empty string", ""],
      ["whitespace", "   "],
      ["decimal string", "12.50"],
      ["decimal number", 1.5],
      ["invalid text", "not-a-number"],
      ["scientific notation", "1e3"],
      ["boolean", true],
    ])("rejects %s", (_label, releasedAmount) => {
      expect(
        () =>
          new AccountReleasedEvent({
            ...validInput,
            releasedAmount,
          }),
      ).toThrow(InvalidArgumentError);
    });

    it("rejects a zero BigInt amount", () => {
      expect(
        () =>
          new AccountReleasedEvent({
            ...validInput,
            releasedAmount: 0n,
          }),
      ).toThrow(InvalidArgumentError);
    });

    it("rejects a negative BigInt amount", () => {
      expect(
        () =>
          new AccountReleasedEvent({
            ...validInput,
            releasedAmount: -1n,
          }),
      ).toThrow(InvalidArgumentError);
    });
  });

  describe("base event validation", () => {
    it("rejects an invalid occurrence date", () => {
      expect(
        () =>
          new AccountReleasedEvent({
            ...validInput,
            occurredAt: "not-a-date",
          }),
      ).toThrow(InvalidArgumentError);
    });
  });
});
