import JournalEntryMapper from "../../../../src/conference-management/accounting-services/ledger/infrastructure/mappers/journal-entry.mapper.js";
import JournalEntryAggregate from "../../../../src/conference-management/accounting-services/ledger/domain/aggregates/journal-entry/journal-entry.aggregate.js";

describe("JournalEntryMapper", () => {
  const entryRow = {
    id: "entry-1",
    tenant_id: "tenant-1",
    idempotency_key: "idem-1",
    correlation_id: "correlation-1",
    description: "Test journal entry",
    currency: "NGN",
    status: "POSTED",
    posted_at: "2026-01-15T10:00:00.000Z",
    metadata: JSON.stringify({ source: "test" }),
  };

  const lineRows = [
    {
      id: "line-1",
      account_id: "account-1",
      amount: "15000",
      direction: "DEBIT",
      currency: "NGN",
    },
    {
      id: "line-2",
      account_id: "account-2",
      amount: "15000",
      direction: "CREDIT",
      currency: "NGN",
    },
  ];

  describe("toDomain", () => {
    test("returns null when the database row is missing", () => {
      expect(JournalEntryMapper.toDomain(null)).toBeNull();
    });

    test("rehydrates persisted journal lines and minor-unit amounts", () => {
      const entry = JournalEntryMapper.toDomain(entryRow, lineRows);

      expect(entry).toBeInstanceOf(JournalEntryAggregate);
      expect(entry.id).toBe("entry-1");
      expect(entry.idempotencyKey).toBe("idem-1");
      expect(entry.currency).toBe("NGN");
      expect(entry.status).toBe("POSTED");
      expect(entry.metadata).toEqual({ source: "test" });

      expect(entry.lines).toHaveLength(2);
      expect(entry.lines[0].id).toBe("line-1");
      expect(entry.lines[0].accountId).toBe("account-1");
      expect(entry.lines[0].amount).toBe(15000n);
      expect(entry.lines[0].direction).toBe("DEBIT");
      expect(entry.lines[1].amount).toBe(15000n);

      expect(() => entry.validateInvariants()).not.toThrow();
    });

    test("accepts metadata already represented as an object", () => {
      const entry = JournalEntryMapper.toDomain({
        ...entryRow,
        metadata: { source: "object" },
      });

      expect(entry.metadata).toEqual({ source: "object" });
    });

    test("falls back to empty metadata when persisted JSON is malformed", () => {
      const entry = JournalEntryMapper.toDomain({
        ...entryRow,
        metadata: "{invalid-json",
      });

      expect(entry.metadata).toEqual({});
    });

    test("falls back to empty metadata when persisted metadata is absent", () => {
      const entry = JournalEntryMapper.toDomain({
        ...entryRow,
        metadata: null,
      });

      expect(entry.metadata).toEqual({});
    });
  });

  describe("toPersistence", () => {
    test("returns null when the aggregate is missing", () => {
      expect(JournalEntryMapper.toPersistence(null)).toBeNull();
    });

    test("maps aggregate JSON into entry and line persistence rows", () => {
      const aggregate = JournalEntryAggregate.create({
        id: "entry-2",
        idempotencyKey: "idem-2",
        description: "Persistence test",
        metadata: { source: "unit-test" },
        lines: [
          {
            id: "line-3",
            accountId: "account-3",
            amount: 25000n,
            direction: "DEBIT",
            currency: "NGN",
          },
          {
            id: "line-4",
            accountId: "account-4",
            amount: 25000n,
            direction: "CREDIT",
            currency: "NGN",
          },
        ],
      });

      const result = JournalEntryMapper.toPersistence(aggregate);

      expect(result.entryRow).toEqual(
        expect.objectContaining({
          id: "entry-2",
          idempotency_key: "idem-2",
          description: "Persistence test",
          currency: "NGN",
          status: "POSTED",
          metadata: JSON.stringify({ source: "unit-test" }),
        }),
      );

      expect(result.entryRow.posted_at).toBeInstanceOf(Date);
      expect(result.lineRows).toEqual([
        {
          id: "line-3",
          journal_entry_id: "entry-2",
          account_id: "account-3",
          amount: "25000",
          direction: "DEBIT",
          currency: "NGN",
        },
        {
          id: "line-4",
          journal_entry_id: "entry-2",
          account_id: "account-4",
          amount: "25000",
          direction: "CREDIT",
          currency: "NGN",
        },
      ]);
    });

    test("supports a plain persistence-shaped aggregate object", () => {
      const result = JournalEntryMapper.toPersistence({
        id: "entry-3",
        idempotencyKey: "idem-3",
        description: "Plain object",
        status: "POSTED",
        currency: "NGN",
        postedAt: "2026-01-15T10:00:00.000Z",
        metadata: {},
        lines: [
          {
            id: "line-5",
            accountId: "account-5",
            amountInMinorUnits: 100n,
            direction: "DEBIT",
            currency: "NGN",
          },
        ],
      });

      expect(result.lineRows[0].amount).toBe("100");
      expect(result.lineRows[0].currency).toBe("NGN");
    });
  });
});
