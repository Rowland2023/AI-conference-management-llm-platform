import { describe, expect, it } from "@jest/globals";

import { JournalEntryReversedEvent } from "../../../../src/conference-management/accounting-services/ledger/domain/events/journal-entry-reversed.event.js";
import { InvalidArgumentError } from "../../../../src/conference-management/accounting-services/ledger/domain/error/index.js";

const validInput = {
  originalJournalEntryId: "journal-original-123",
  reversalJournalEntryId: "journal-reversal-456",
};

describe("JournalEntryReversedEvent", () => {
  describe("construction", () => {
    it("creates an event with the expected identity and payload", () => {
      const event = new JournalEntryReversedEvent(validInput);

      expect(event.eventName).toBe("journal_entry.reversed");
      expect(event.aggregateId).toBe("journal-original-123");
      expect(event.version).toBe(1);
      expect(event.eventId).toBeTruthy();
      expect(event.payload).toEqual({
        originalJournalEntryId: "journal-original-123",
        reversalJournalEntryId: "journal-reversal-456",
        reason: "Unspecified reversal",
      });
    });

    it("preserves an explicitly supplied event ID and occurrence time", () => {
      const occurredAt = new Date("2026-01-15T10:30:00.000Z");

      const event = new JournalEntryReversedEvent({
        ...validInput,
        eventId: "event-reversal-123",
        occurredAt,
      });

      expect(event.eventId).toBe("event-reversal-123");
      expect(event.occurredAt).toBe(occurredAt);
    });

    it("generates an event ID when none is supplied", () => {
      const event = new JournalEntryReversedEvent(validInput);

      expect(typeof event.eventId).toBe("string");
      expect(event.eventId.length).toBeGreaterThan(0);
    });

    it("trims a custom reversal reason", () => {
      const event = new JournalEntryReversedEvent({
        ...validInput,
        reason: "  Duplicate transaction  ",
      });

      expect(event.payload.reason).toBe("Duplicate transaction");
    });

    it.each([
      ["empty string", ""],
      ["whitespace", "   "],
      ["null", null],
      ["undefined", undefined],
      ["non-string", 123],
    ])("uses the default reason for %s", (_label, reason) => {
      const event = new JournalEntryReversedEvent({
        ...validInput,
        reason,
      });

      expect(event.payload.reason).toBe("Unspecified reversal");
    });

    it("preserves metadata and serializes the event to JSON", () => {
      const occurredAt = new Date("2026-01-15T10:30:00.000Z");
      const metadata = {
        correlationId: "correlation-reversal-123",
        source: "ledger",
      };

      const event = new JournalEntryReversedEvent({
        ...validInput,
        occurredAt,
        eventId: "event-reversal-123",
        reason: "Customer request",
        metadata,
      });

      expect(event.metadata).toEqual(metadata);
      expect(event.toJSON()).toEqual({
        eventId: "event-reversal-123",
        eventName: "journal_entry.reversed",
        aggregateId: "journal-original-123",
        version: 1,
        occurredAt: "2026-01-15T10:30:00.000Z",
        payload: {
          originalJournalEntryId: "journal-original-123",
          reversalJournalEntryId: "journal-reversal-456",
          reason: "Customer request",
        },
        metadata,
      });
    });

    it("freezes the event and its top-level payload and metadata", () => {
      const event = new JournalEntryReversedEvent({
        ...validInput,
        metadata: { source: "ledger" },
      });

      expect(Object.isFrozen(event)).toBe(true);
      expect(Object.isFrozen(event.payload)).toBe(true);
      expect(Object.isFrozen(event.metadata)).toBe(true);
    });
  });

  describe("required identifiers", () => {
    it.each([
      ["originalJournalEntryId", undefined],
      ["originalJournalEntryId", ""],
      ["originalJournalEntryId", "   "],
      ["originalJournalEntryId", null],
      ["originalJournalEntryId", 123],
      ["reversalJournalEntryId", undefined],
      ["reversalJournalEntryId", ""],
      ["reversalJournalEntryId", "   "],
      ["reversalJournalEntryId", null],
      ["reversalJournalEntryId", 123],
    ])("rejects invalid %s value %s", (field, value) => {
      expect(
        () =>
          new JournalEntryReversedEvent({
            ...validInput,
            [field]: value,
          }),
      ).toThrow(InvalidArgumentError);
    });
  });

  describe("base event validation", () => {
    it("rejects an invalid occurrence date", () => {
      expect(
        () =>
          new JournalEntryReversedEvent({
            ...validInput,
            occurredAt: "not-a-date",
          }),
      ).toThrow(InvalidArgumentError);
    });
  });
});
