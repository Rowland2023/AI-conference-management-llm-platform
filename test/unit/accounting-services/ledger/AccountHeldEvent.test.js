
import { describe, expect, it } from "@jest/globals";

import { AccountHeldEvent } from "../../../../src/conference-management/accounting-services/ledger/domain/events/account-held.event.js";
import { InvalidArgumentError } from "../../../../src/conference-management/accounting-services/ledger/domain/error/index.js";

const validInput = {
  accountId: "account-123",
  holdId: "hold-456",
  idempotencyKey: "idem-789",
  amount: "12500",
  currency: " ngn ",
  expiresAt: "2030-01-01T12:00:00.000Z",
};

describe("AccountHeldEvent", () => {
  describe("construction", () => {
    it("creates an event with the expected identity and payload", () => {
      const event = new AccountHeldEvent(validInput);

      expect(event.eventName).toBe("account.held");
      expect(event.aggregateId).toBe("account-123");
      expect(event.version).toBe(1);
      expect(event.eventId).toBeTruthy();

      expect(event.payload).toEqual({
        accountId: "account-123",
        holdId: "hold-456",
        idempotencyKey: "idem-789",
        amount: "12500",
        currency: "NGN",
        expiresAt: "2030-01-01T12:00:00.000Z",
      });
    });

    it("preserves an explicitly supplied event ID and occurrence time", () => {
      const occurredAt = new Date("2026-01-15T10:30:00.000Z");

      const event = new AccountHeldEvent({
        ...validInput,
        eventId: "event-123",
        occurredAt,
      });

      expect(event.eventId).toBe("event-123");
      expect(event.occurredAt).toBe(occurredAt);
    });

    it("generates an event ID when none is supplied", () => {
      const event = new AccountHeldEvent(validInput);

      expect(typeof event.eventId).toBe("string");
      expect(event.eventId.length).toBeGreaterThan(0);
    });

    it("preserves metadata and serializes the event to JSON", () => {
      const occurredAt = new Date("2026-01-15T10:30:00.000Z");
      const metadata = {
        correlationId: "correlation-123",
        source: "ledger",
      };

      const event = new AccountHeldEvent({
        ...validInput,
        occurredAt,
        metadata,
      });

      expect(event.metadata).toEqual(metadata);
      expect(event.toJSON()).toEqual({
        eventId: event.eventId,
        eventName: "account.held",
        aggregateId: "account-123",
        version: 1,
        occurredAt: "2026-01-15T10:30:00.000Z",
        payload: {
          accountId: "account-123",
          holdId: "hold-456",
          idempotencyKey: "idem-789",
          amount: "12500",
          currency: "NGN",
          expiresAt: "2030-01-01T12:00:00.000Z",
        },
        metadata,
      });
    });

    it("preserves large amounts without losing integer precision", () => {
      const event = new AccountHeldEvent({
        ...validInput,
        amount: "900719925474099312345",
      });

      expect(event.payload.amount).toBe("900719925474099312345");
    });
  });

  describe("required identifiers", () => {
    it.each([
      ["accountId", undefined],
      ["accountId", ""],
      ["accountId", "   "],
      ["accountId", null],
      ["holdId", undefined],
      ["holdId", ""],
      ["holdId", "   "],
      ["holdId", null],
      ["idempotencyKey", undefined],
      ["idempotencyKey", ""],
      ["idempotencyKey", "   "],
      ["idempotencyKey", null],
    ])("rejects invalid %s value %s", (field, value) => {
      expect(
        () => new AccountHeldEvent({ ...validInput, [field]: value }),
      ).toThrow(InvalidArgumentError);
    });
  });

  describe("amount validation", () => {
    it.each([
      ["0"],
      ["-1"],
      [0],
      [-100],
      [null],
      [undefined],
      [""],
      ["12.50"],
      ["not-a-number"],
      [1.5],
    ])("rejects invalid amount %s", (amount) => {
      expect(
        () => new AccountHeldEvent({ ...validInput, amount }),
      ).toThrow(InvalidArgumentError);
    });

    it("accepts a positive BigInt amount", () => {
      const event = new AccountHeldEvent({
        ...validInput,
        amount: 9007199254740993n,
      });

      expect(event.payload.amount).toBe("9007199254740993");
    });
  });

  describe("currency validation", () => {
    it.each([
      [undefined],
      [null],
      [""],
      ["US"],
      ["USDD"],
      ["1$A"],
    ])("rejects invalid currency %s", (currency) => {
      expect(
        () => new AccountHeldEvent({ ...validInput, currency }),
      ).toThrow(InvalidArgumentError);
    });

    it("normalizes lowercase currency codes", () => {
      const event = new AccountHeldEvent({
        ...validInput,
        currency: "usd",
      });

      expect(event.payload.currency).toBe("USD");
    });
  });

  describe("expiry validation", () => {
    it("normalizes Date instances to ISO strings", () => {
      const event = new AccountHeldEvent({
        ...validInput,
        expiresAt: new Date("2030-06-01T08:00:00.000Z"),
      });

      expect(event.payload.expiresAt).toBe("2030-06-01T08:00:00.000Z");
    });

    it("uses null when expiry is omitted", () => {
      const { expiresAt, ...input } = validInput;

      const event = new AccountHeldEvent(input);

      expect(event.payload.expiresAt).toBeNull();
    });

    it("uses null when expiry is explicitly null", () => {
      const event = new AccountHeldEvent({
        ...validInput,
        expiresAt: null,
      });

      expect(event.payload.expiresAt).toBeNull();
    });

    it("rejects an invalid expiry date", () => {
      expect(
        () =>
          new AccountHeldEvent({
            ...validInput,
            expiresAt: "not-a-date",
          }),
      ).toThrow(InvalidArgumentError);
    });
  });
});
