import { jest } from "@jest/globals";
import { PostgresJournalEntryRepository } from "../../../../src/conference-management/accounting-services/ledger/infrastructure/repositories/postgres-journal-entry.repository.js";

describe("PostgresJournalEntryRepository.calculateAccountBalance", () => {
    const tenantId = "tenant-1";
    const accountId = "account-1";
    const asOfDate = new Date("2026-10-27T12:00:00.000Z");

    let query;
    let knex;
    let repository;

    beforeEach(() => {
        query = {
            join: jest.fn(function () {
                return this;
            }),
            where: jest.fn(function () {
                return this;
            }),
            select: jest.fn(function () {
                return this;
            }),
            first: jest.fn().mockResolvedValue({
                net_balance: "750",
            }),
        };

        knex = jest.fn(() => query);
        knex.raw = jest.fn((sql) => sql);

        repository = new PostgresJournalEntryRepository({
            knex,
        });
    });

    it("calculates a debit-normal account balance", async () => {
        const result = await repository.calculateAccountBalance({
            tenantId,
            accountId,
            currency: "NGN",
            asOfDate,
            accountType: "ASSET",
        });

        expect(result).toEqual({
            postedBalance: "750",
        });
    });

    it("reverses the sign for a credit-normal account", async () => {
        const result = await repository.calculateAccountBalance({
            tenantId,
            accountId,
            currency: "NGN",
            asOfDate,
            accountType: "LIABILITY",
        });

        expect(result).toEqual({
            postedBalance: "-750",
        });
    });

    it("preserves large balances without losing precision", async () => {
        query.first.mockResolvedValue({
            net_balance: "90071992547409931234",
        });

        const result = await repository.calculateAccountBalance({
            tenantId,
            accountId,
            currency: "NGN",
            asOfDate,
            accountType: "ASSET",
        });

        expect(result.postedBalance).toBe("90071992547409931234");
    });

    it("rejects an invalid account type", async () => {
        await expect(
            repository.calculateAccountBalance({
                tenantId,
                accountId,
                currency: "NGN",
                asOfDate,
                accountType: "UNKNOWN",
            }),
        ).rejects.toThrow("Invalid account type");

        expect(knex).not.toHaveBeenCalled();
    });

    it("rejects a malformed database balance", async () => {
        query.first.mockResolvedValue({
            net_balance: "not-a-number",
        });

        await expect(
            repository.calculateAccountBalance({
                tenantId,
                accountId,
                currency: "NGN",
                asOfDate,
                accountType: "ASSET",
            }),
        ).rejects.toThrow("invalid ledger balance");
    });

    it("applies tenant, account, currency, and posting-date filters", async () => {
        await repository.calculateAccountBalance({
            tenantId,
            accountId,
            currency: "NGN",
            asOfDate,
            accountType: "ASSET",
        });

        expect(knex).toHaveBeenCalledWith("ledger_entries as le");
        expect(query.where).toHaveBeenCalledWith("le.tenant_id", tenantId);
        expect(query.where).toHaveBeenCalledWith("lj.tenant_id", tenantId);
        expect(query.where).toHaveBeenCalledWith("le.account_id", accountId);
        expect(query.where).toHaveBeenCalledWith("le.currency", "NGN");
        expect(query.where).toHaveBeenCalledWith("lj.currency", "NGN");
        expect(query.where).toHaveBeenCalledWith(
            "lj.posted_at",
            "<=",
            asOfDate,
        );
    });
});