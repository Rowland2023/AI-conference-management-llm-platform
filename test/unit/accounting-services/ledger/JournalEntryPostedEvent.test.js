import { describe, expect, it } from "@jest/globals";

import { JournalEntryPostedEvent } from "../../../../src/conference-management/accounting-services/ledger/domain/events/journal-entry-posted.event.js";
import { InvalidArgumentError } from "../../../../src/conference-management/accounting-services/ledger/domain/error/index.js";

const validInput = {
  journalEntryId: "journal-123",
  idempotencyKey: "idem-456",
  description: "Transfer between accounts",
  lines: [
    {
      accountId: "account-debit",
      amount: 12500,
      direction: "debit",
      currency: "NGN",
    },
    {
      accountId: "account-credit",
      amount: 12500,
      direction: "credit",
      currency: "NGN",
    },
  ],
};

describe("JournalEntryPostedEvent", () => {
  describe("construction", () => {
    it("creates an event with the expected identity and payload", () => {
      const event = new JournalEntryPostedEvent(validInput);

      expect(event.eventName).toBe("journal_entry.posted");
      expect(event.aggregateId).toBe("journal-123");
      expect(event.version).toBe(1);
      expect(event.eventId).toBeTruthy();
      expect(event.payload).toEqual({
        journalEntryId: "journal-123",
        idempotencyKey: "idem-456",
        description: "Transfer between accounts",
        lines: validInput.lines.map((line) => ({
          ...line,
          amount: String(line.amount),
        })),
      });
    });

    it("generates an event ID when none is supplied", () => {
      const event = new JournalEntryPostedEvent(validInput);

      expect(typeof event.eventId).toBe("string");
      expect(event.eventId.length).toBeGreaterThan(0);
    });

    it("preserves an explicitly supplied event ID and occurrence time", () => {
      const occurredAt = new Date("2026-01-15T10:30:00.000Z");

      const event = new JournalEntryPostedEvent({
        ...validInput,
        eventId: "event-posted-123",
        occurredAt,
      });

      expect(event.eventId).toBe("event-posted-123");
      expect(event.occurredAt).toBe(occurredAt);
    });

    it("defaults description to an empty string", () => {
      const { description, ...input } = validInput;
      const event = new JournalEntryPostedEvent(input);

      expect(event.payload.description).toBe("");
    });

    it("serializes BigInt amounts as strings", () => {
      const event = new JournalEntryPostedEvent({
        ...validInput,
        lines: [
          {
            accountId: "account-debit",
            amount: 900719925474099312345n,
            direction: "debit",
            currency: "NGN",
          },
          {
            accountId: "account-credit",
            amount: 900719925474099312345n,
            direction: "credit",
            currency: "NGN",
          },
        ],
      });

      expect(event.payload.lines.map((line) => line.amount)).toEqual([
        "900719925474099312345",
        "900719925474099312345",
      ]);
    });

    it("stringifies numeric amounts and preserves line currencies", () => {
      const event = new JournalEntryPostedEvent(validInput);

      expect(event.payload.lines[0]).toEqual({
        accountId: "account-debit",
        amount: "12500",
        direction: "debit",
        currency: "NGN",
      });
    });

    it("preserves metadata and serializes the event to JSON", () => {
      const occurredAt = new Date("2026-01-15T10:30:00.000Z");
      const metadata = {
        correlationId: "correlation-123",
        source: "ledger",
      };

      const event = new JournalEntryPostedEvent({
        ...validInput,
        eventId: "event-posted-123",
        occurredAt,
        metadata,
      });

      expect(event.metadata).toEqual(metadata);
      expect(event.toJSON()).toEqual({
        eventId: "event-posted-123",
        eventName: "journal_entry.posted",
        aggregateId: "journal-123",
        version: 1,
        occurredAt: "2026-01-15T10:30:00.000Z",
        payload: {
          journalEntryId: "journal-123",
          idempotencyKey: "idem-456",
          description: "Transfer between accounts",
          lines: validInput.lines.map((line) => ({
            ...line,
            amount: String(line.amount),
          })),
        },
        metadata,
      });
    });

    it("allows a zero amount because this event checks presence, not positivity", () => {
      const event = new JournalEntryPostedEvent({
        ...validInput,
        lines: [
          { accountId: "account-a", amount: 0, direction: "debit" },
          { accountId: "account-b", amount: 0, direction: "credit" },
        ],
      });

      expect(event.payload.lines.map((line) => line.amount)).toEqual([
        "0",
        "0",
      ]);
    });
  });

  describe("required identifiers", () => {
    it.each([
      ["journalEntryId", undefined],
      ["journalEntryId", ""],
      ["journalEntryId", "   "],
      ["journalEntryId", null],
      ["journalEntryId", 123],
      ["idempotencyKey", undefined],
      ["idempotencyKey", ""],
      ["idempotencyKey", "   "],
      ["idempotencyKey", null],
      ["idempotencyKey", 123],
    ])("rejects invalid %s value %s", (field, value) => {
      expect(
        () =>
          new JournalEntryPostedEvent({
            ...validInput,
            [field]: value,
          }),
      ).toThrow(InvalidArgumentError);
    });
  });

  describe("journal line validation", () => {
    it.each([
      ["undefined", undefined],
      ["null", null],
      ["empty array", []],
      ["one line", [validInput.lines[0]]],
    ])("rejects %s lines", (_label, lines) => {
      expect(
        () => new JournalEntryPostedEvent({ ...validInput, lines }),
      ).toThrow(InvalidArgumentError);
    });

    it.each([
      ["missing accountId", { amount: 100, direction: "debit" }],
      ["empty accountId", { accountId: "", amount: 100, direction: "debit" }],
      ["missing direction", { accountId: "account-a", amount: 100 }],
      ["empty direction", { accountId: "account-a", amount: 100, direction: "" }],
      ["missing amount", { accountId: "account-a", direction: "debit" }],
      ["null amount", { accountId: "account-a", direction: "debit", amount: null }],
    ])("rejects a journal line with %s", (_label, invalidLine) => {
      expect(
        () =>
          new JournalEntryPostedEvent({
            ...validInput,
            lines: [invalidLine, validInput.lines[1]],
          }),
      ).toThrow(InvalidArgumentError);
    });

    it("reports the index of an invalid journal line", () => {
      expect(
        () =>
          new JournalEntryPostedEvent({
            ...validInput,
            lines: [
              validInput.lines[0],
              { accountId: "account-credit", direction: "credit" },
            ],
          }),
      ).toThrow("Invalid journal line at index 1");
    });
  });

  describe("base event validation", () => {
    it("rejects an invalid occurrence date", () => {
      expect(
        () =>
          new JournalEntryPostedEvent({
            ...validInput,
            occurredAt: "not-a-date",
          }),
      ).toThrow(InvalidArgumentError);
    });
  });
});
