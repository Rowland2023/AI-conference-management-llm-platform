import { jest } from "@jest/globals";
import JournalEntryAggregate from "../../../../src/conference-management/accounting-services/ledger/domain/aggregates/journal-entry/journal-entry.aggregate.js";
import { PostgresJournalEntryRepository } from "../../../../src/conference-management/accounting-services/ledger/infrastructure/repositories/postgres-journal-entry.repository.js";

describe("PostgresJournalEntryRepository", () => {
    const tenantId = "tenant-1";

    const createEntry = () =>
        JournalEntryAggregate.create({
            id: "entry-1",
            idempotencyKey: "request-1",
            description: "Repository unit test",
            metadata: { source: "unit-test" },
            lines: [
                {
                    id: "line-1",
                    accountId: "account-1",
                    amount: "1000",
                    direction: "DEBIT",
                    currency: "USD",
                },
                {
                    id: "line-2",
                    accountId: "account-2",
                    amount: "1000",
                    direction: "CREDIT",
                    currency: "USD",
                },
            ],
        });

    const createInsertClient = () => {
        const inserted = {
            journal_entries: [],
            journal_lines: [],
        };

        const client = jest.fn((table) => ({
            insert: jest.fn(async (rows) => {
                inserted[table].push(rows);
            }),
        }));

        return { client, inserted };
    };

    test("rejects a missing aggregate before opening a transaction", async () => {
        const knex = {
            transaction: jest.fn(),
        };
        const repository = new PostgresJournalEntryRepository({ knex });

        await expect(repository.save(null, { tenantId })).rejects.toThrow(
            "Journal entry aggregate is required.",
        );

        expect(knex.transaction).not.toHaveBeenCalled();
    });

    test("rejects a missing tenant ID before opening a transaction", async () => {
        const knex = {
            transaction: jest.fn(),
        };
        const repository = new PostgresJournalEntryRepository({ knex });

        await expect(repository.save(createEntry())).rejects.toThrow(
            "tenant_id is required.",
        );

        expect(knex.transaction).not.toHaveBeenCalled();
    });

    test("inserts the entry and its lines in one transaction", async () => {
        const { client: trx, inserted } = createInsertClient();
        const knex = {
            transaction: jest.fn(async (callback) => callback(trx)),
        };
        const repository = new PostgresJournalEntryRepository({ knex });

        await repository.save(createEntry(), { tenantId });

        expect(knex.transaction).toHaveBeenCalledTimes(1);
        expect(trx).toHaveBeenCalledWith("journal_entries");
        expect(trx).toHaveBeenCalledWith("journal_lines");
        expect(inserted.journal_entries).toHaveLength(1);
        expect(inserted.journal_lines).toHaveLength(1);
        expect(inserted.journal_entries[0]).toMatchObject({
            id: "entry-1",
            tenant_id: tenantId,
            idempotency_key: "request-1",
        });
        expect(inserted.journal_lines[0]).toHaveLength(2);
        expect(
            inserted.journal_lines[0].every(
                (line) => line.tenant_id === tenantId,
            ),
        ).toBe(true);
    });

    test("uses a supplied transaction instead of opening another transaction", async () => {
        const { client: trx, inserted } = createInsertClient();
        const knex = {
            transaction: jest.fn(),
        };
        const repository = new PostgresJournalEntryRepository({ knex });

        await repository.save(createEntry(), {
            tenantId,
            transaction: trx,
        });

        expect(knex.transaction).not.toHaveBeenCalled();
        expect(inserted.journal_entries).toHaveLength(1);
        expect(inserted.journal_lines).toHaveLength(1);
    });

    test("requires a transaction for findByIdForUpdate", async () => {
        const knex = jest.fn();
        const repository = new PostgresJournalEntryRepository({ knex });

        await expect(
            repository.findByIdForUpdate(tenantId, "entry-1"),
        ).rejects.toThrow(
            "findByIdForUpdate requires an active transaction.",
        );

        expect(knex).not.toHaveBeenCalled();
    });

    test("requires a transaction for an idempotency lookup with FOR UPDATE", async () => {
        const knex = jest.fn();
        const repository = new PostgresJournalEntryRepository({ knex });

        await expect(
            repository.findByIdempotencyKey(
                tenantId,
                "request-1",
                { forUpdate: true },
            ),
        ).rejects.toThrow(
            "Idempotency lookup with FOR UPDATE requires an active transaction.",
        );

        expect(knex).not.toHaveBeenCalled();
    });

    test("validates updateStatus arguments before issuing a query", async () => {
        const knex = jest.fn();
        const repository = new PostgresJournalEntryRepository({ knex });

        await expect(
            repository.updateStatus(tenantId, "entry-1", " "),
        ).rejects.toThrow("Journal entry status is required.");

        await expect(
            repository.updateStatus(tenantId, "entry-1", "REVERSED", []),
        ).rejects.toThrow("metadataPatch must be an object.");

        expect(knex).not.toHaveBeenCalled();
    });

    test("scopes updateStatus to the tenant and entry and applies a metadata patch", async () => {
        const update = jest.fn().mockResolvedValue(1);
        const where = jest.fn(() => ({ update }));
        const raw = jest.fn((sql, bindings) => ({ sql, bindings }));
        const client = jest.fn(() => ({
            where,
            raw,
        }));
        client.raw = raw;

        const repository = new PostgresJournalEntryRepository({
            knex: client,
        });

        await expect(
            repository.updateStatus(
                tenantId,
                "entry-1",
                "REVERSED",
                { reason: "Correction" },
            ),
        ).resolves.toBe(1);

        expect(client).toHaveBeenCalledWith("journal_entries");
        expect(where).toHaveBeenCalledWith({
            tenant_id: tenantId,
            id: "entry-1",
        });

        const updatePayload = update.mock.calls[0][0];
        expect(updatePayload.status).toBe("REVERSED");
        expect(updatePayload.metadata).toMatchObject({
            sql: "COALESCE(metadata, '{}'::jsonb) || ?::jsonb",
            bindings: ['{"reason":"Correction"}'],
        });
        expect(updatePayload.updated_at).toBeInstanceOf(Date);
    });
});
