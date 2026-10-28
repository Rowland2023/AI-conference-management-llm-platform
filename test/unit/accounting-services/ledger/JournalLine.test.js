import JournalLine from "../../../../src/conference-management/accounting-services/ledger/domain/aggregates/journal-entry/journal-line.entity.js";
import { InvalidArgumentError } from "../../../../src/conference-management/accounting-services/ledger/domain/error/index.js";

describe("JournalLine", () => {
    const validLine = {
        id: "line-1",
        accountId: "account-1",
        amount: "1500",
        direction: "DEBIT",
        currency: "USD",
    };

    test("creates a line with normalized direction and currency", () => {
        const line = new JournalLine({
            ...validLine,
            direction: "debit",
            currency: "usd",
        });

        expect(line.amount).toBe(1500n);
        expect(line.direction).toBe("DEBIT");
        expect(line.currency).toBe("USD");
        expect(line.accountId).toBe("account-1");
    });

    test("rejects a missing or blank account ID", () => {
        for (const accountId of [undefined, null, "", "   "]) {
            expect(
                () => new JournalLine({ ...validLine, accountId }),
            ).toThrow(InvalidArgumentError);
        }
    });

    test("rejects an invalid direction", () => {
        expect(
            () => new JournalLine({ ...validLine, direction: "TRANSFER" }),
        ).toThrow("direction must be either 'DEBIT' or 'CREDIT'");
    });

    test("rejects invalid currency codes", () => {
        for (const currency of ["", "US", "USDD", "12A", undefined]) {
            expect(
                () => new JournalLine({ ...validLine, currency }),
            ).toThrow(InvalidArgumentError);
        }
    });

    test("rejects missing, decimal, and non-integer amounts", () => {
        for (const amount of [undefined, null, "10.50", 10.5, "abc"]) {
            expect(
                () => new JournalLine({ ...validLine, amount }),
            ).toThrow(InvalidArgumentError);
        }
    });

    test("rejects zero and negative amounts", () => {
        for (const amount of ["0", "-1", 0, -1]) {
            expect(
                () => new JournalLine({ ...validLine, amount }),
            ).toThrow("amount must be strictly greater than zero");
        }
    });

    test("accepts a positive BigInt amount", () => {
        const line = new JournalLine({
            ...validLine,
            amount: 9007199254740993n,
        });

        expect(line.amount).toBe(9007199254740993n);
    });

    test("serializes the amount as a string", () => {
        const line = new JournalLine(validLine);

        expect(line.toJSON()).toEqual({
            id: "line-1",
            accountId: "account-1",
            amount: "1500",
            direction: "DEBIT",
            currency: "USD",
        });
    });

    test("is immutable", () => {
        const line = new JournalLine(validLine);

        expect(Object.isFrozen(line)).toBe(true);
    });
});
