
import { jest } from "@jest/globals";
import JournalEntryAggregate from "../../../../src/conference-management/accounting-services/ledger/domain/aggregates/journal-entry/journal-entry.aggregate.js";
import {
    InvalidArgumentError,
    InvalidStateError,
    UnbalancedEntryError,
} from "../../../../src/conference-management/accounting-services/ledger/domain/error/index.js";

describe("JournalEntryAggregate", () => {
    const validLines = [
        {
            accountId: "account-1",
            amount: "1000",
            direction: "DEBIT",
            currency: "USD",
        },
        {
            accountId: "account-2",
            amount: "1000",
            direction: "CREDIT",
            currency: "USD",
        },
    ];

    const createEntry = (overrides = {}) =>
        JournalEntryAggregate.create({
            id: "entry-1",
            idempotencyKey: "request-1",
            description: "Test journal entry",
            lines: validLines,
            metadata: { source: "unit-test" },
            ...overrides,
        });

    beforeEach(() => {
        jest.useRealTimers();
    });

    test("creates a balanced entry and exposes its properties", () => {
        const entry = createEntry();

        expect(entry.id).toBe("entry-1");
        expect(entry.idempotencyKey).toBe("request-1");
        expect(entry.description).toBe("Test journal entry");
        expect(entry.status).toBe("POSTED");
        expect(entry.currency).toBe("USD");
        expect(entry.lines).toHaveLength(2);
        expect(entry.metadata).toEqual({ source: "unit-test" });
    });

    test("rejects an empty idempotency key", () => {
        expect(
            () =>
                new JournalEntryAggregate({
                    idempotencyKey: " ",
                }),
        ).toThrow(InvalidArgumentError);
    });

    test("rejects an unsupported status", () => {
        expect(
            () =>
                new JournalEntryAggregate({
                    idempotencyKey: "request-1",
                    status: "PENDING",
                }),
        ).toThrow(InvalidArgumentError);
    });

    test("rejects an invalid posting date", () => {
        expect(
            () =>
                new JournalEntryAggregate({
                    idempotencyKey: "request-1",
                    postedAt: "not-a-date",
                }),
        ).toThrow(InvalidArgumentError);
    });

    test("rejects entries with fewer than two lines", () => {
        expect(() =>
            JournalEntryAggregate.create({
                idempotencyKey: "request-1",
                lines: [validLines[0]],
            }),
        ).toThrow(UnbalancedEntryError);
    });

    test("rejects entries whose debit and credit totals differ", () => {
        expect(() =>
            JournalEntryAggregate.create({
                idempotencyKey: "request-1",
                lines: [
                    validLines[0],
                    { ...validLines[1], amount: "900" },
                ],
            }),
        ).toThrow(UnbalancedEntryError);
    });

    test("rejects lines with different currencies", () => {
        expect(() =>
            JournalEntryAggregate.create({
                idempotencyKey: "request-1",
                lines: [
                    validLines[0],
                    { ...validLines[1], currency: "EUR" },
                ],
            }),
        ).toThrow(InvalidArgumentError);
    });

    test("returns defensive copies of lines and metadata", () => {
        const entry = createEntry();
        const lines = entry.lines;
        const metadata = entry.metadata;

        expect(Object.isFrozen(lines)).toBe(true);
        expect(Object.isFrozen(metadata)).toBe(true);
        expect(lines).not.toBe(entry.lines);
        expect(metadata).not.toBe(entry.metadata);
    });

    test("serializes the entry and its lines to JSON", () => {
    const entry = createEntry();
    const json = entry.toJSON();

    expect(json).toMatchObject({
        id: "entry-1",
        idempotencyKey: "request-1",
        status: "POSTED",
        currency: "USD",
        metadata: { source: "unit-test" },
    });

    expect(new Date(json.postedAt).toISOString()).toBe(json.postedAt);
    expect(json.lines).toHaveLength(2);
    expect(json.lines[0]).toHaveProperty("accountId", "account-1");
});

    test("creates a reversal with debit and credit directions swapped", () => {
        const entry = createEntry();

        const reversal = entry.createReversal({
            reversalIdempotencyKey: "reversal-1",
            reason: "Correction",
        });

        expect(entry.status).toBe("REVERSED");
        expect(reversal.status).toBe("POSTED");
        expect(reversal.idempotencyKey).toBe("reversal-1");
        expect(reversal.lines.map((line) => line.direction)).toEqual([
            "CREDIT",
            "DEBIT",
        ]);
        expect(reversal.lines.map((line) => line.amount)).toEqual([
            1000n,
            1000n,
        ]);
        expect(reversal.metadata).toMatchObject({
            reversedEntryId: "entry-1",
            reversedIdempotencyKey: "request-1",
            reason: "Correction",
        });
    });

    test("rejects a reversal with a blank reason", () => {
        const entry = createEntry();

        expect(() =>
            entry.createReversal({
                reversalIdempotencyKey: "reversal-1",
                reason: " ",
            }),
        ).toThrow(InvalidArgumentError);

        expect(entry.status).toBe("POSTED");
    });

    test("rejects reversing an already reversed entry", () => {
        const entry = createEntry();

        entry.createReversal({
            reversalIdempotencyKey: "reversal-1",
            reason: "Correction",
        });

        expect(() =>
            entry.createReversal({
                reversalIdempotencyKey: "reversal-2",
                reason: "Second reversal",
            }),
        ).toThrow(InvalidStateError);
    });

    test("rejects adding a line after reversal", () => {
        const entry = createEntry();

        entry.createReversal({
            reversalIdempotencyKey: "reversal-1",
            reason: "Correction",
        });

        expect(() => entry.addLine(validLines[0])).toThrow(InvalidStateError);
    });
});
