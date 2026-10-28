import { PostJournalEntryUseCase } from "../../../../src/conference-management/accounting-services/ledger/application/use-case/post-journal-entry.usecase.js";
import { jest } from "@jest/globals";

describe("PostJournalEntryUseCase", () => {
    let journalEntryRepository;
    let accountRepository;
    let unitOfWork;
    let outboxRepository;
    let logger;
    let metrics;
    let useCase;

    const lines = [
        {
            accountId: "account-1",
            amountInMinorUnits: "1000",
            direction: "DEBIT",
            currency: "USD",
        },
        {
            accountId: "account-2",
            amountInMinorUnits: "1000",
            direction: "CREDIT",
            currency: "USD",
        },
    ];

    beforeEach(() => {
        journalEntryRepository = {
            findByIdempotencyKey: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({
                id: "journal-123",
                currency: "USD",
                status: "POSTED",
            }),
        };

        accountRepository = {
            findAndLockByIds: jest.fn().mockResolvedValue([
                { id: "account-1", status: "ACTIVE", currency: "USD" },
                { id: "account-2", status: "ACTIVE", currency: "USD" },
            ]),
        };

        unitOfWork = {
            execute: jest.fn(async (callback) => callback({ transaction: true })),
        };

        outboxRepository = {
            add: jest.fn().mockResolvedValue(undefined),
        };

        logger = { info: jest.fn() };
        metrics = { increment: jest.fn() };

        useCase = new PostJournalEntryUseCase({
            journalEntryRepository,
            accountRepository,
            unitOfWork,
            outboxRepository,
            logger,
            metrics,
        });
    });

    test("returns an existing journal entry for a duplicate idempotency key", async () => {
        const existing = { id: "journal-existing", status: "POSTED" };
        journalEntryRepository.findByIdempotencyKey.mockResolvedValue(existing);

        const result = await useCase.execute({
            idempotencyKey: "request-1",
            lines,
        });

        expect(result).toEqual({ ...existing, isDuplicate: true });
        expect(unitOfWork.execute).not.toHaveBeenCalled();
        expect(journalEntryRepository.create).not.toHaveBeenCalled();
    });

    test("rejects an unbalanced journal entry before opening a transaction", async () => {
        const unbalancedLines = [
            { ...lines[0], amountInMinorUnits: "1000" },
            { ...lines[1], amountInMinorUnits: "900" },
        ];

        await expect(
            useCase.execute({
                idempotencyKey: "request-unbalanced",
                lines: unbalancedLines,
            }),
        ).rejects.toThrow(/Debits .* must equal credits/);

        expect(unitOfWork.execute).not.toHaveBeenCalled();
    });

    test("rejects journal entries with fewer than two lines", async () => {
        await expect(
            useCase.execute({
                idempotencyKey: "request-invalid",
                lines: [lines[0]],
            }),
        ).rejects.toThrow("Journal entry must contain at least two lines.");

        expect(unitOfWork.execute).not.toHaveBeenCalled();
    });

    test("rejects entries when one or more accounts do not exist", async () => {
        accountRepository.findAndLockByIds.mockResolvedValue([
            { id: "account-1", status: "ACTIVE", currency: "USD" },
        ]);

        await expect(
            useCase.execute({
                idempotencyKey: "request-missing-account",
                lines,
            }),
        ).rejects.toThrow("One or more accounts do not exist.");

        expect(journalEntryRepository.create).not.toHaveBeenCalled();
        expect(outboxRepository.add).not.toHaveBeenCalled();
    });

    test("creates a posted entry and writes its domain event to the outbox", async () => {
        const result = await useCase.execute({
            idempotencyKey: "request-success",
            description: "Test journal posting",
            lines,
            metadata: { source: "unit-test" },
            requestedBy: "user-123",
        });

        expect(result).toEqual({
            id: "journal-123",
            currency: "USD",
            status: "POSTED",
            isDuplicate: false,
        });

        expect(accountRepository.findAndLockByIds).toHaveBeenCalledWith(
            ["account-1", "account-2"],
            { session: { transaction: true } },
        );

        expect(journalEntryRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({
                idempotencyKey: "request-success",
                currency: "USD",
                status: "POSTED",
                lines: expect.arrayContaining([
                    expect.objectContaining({ amountInMinorUnits: "1000" }),
                ]),
            }),
            { session: { transaction: true } },
        );

        expect(outboxRepository.add).toHaveBeenCalledWith(
            expect.objectContaining({}),
            { session: { transaction: true } },
        );

        expect(logger.info).toHaveBeenCalled();
        expect(metrics.increment).toHaveBeenCalledWith(
            "ledger.journal.posted",
            1,
            { currency: "USD" },
        );
    });

    test("rejects an inactive account", async () => {
        accountRepository.findAndLockByIds.mockResolvedValue([
            { id: "account-1", status: "INACTIVE", currency: "USD" },
            { id: "account-2", status: "ACTIVE", currency: "USD" },
        ]);

        await expect(
            useCase.execute({
                idempotencyKey: "request-inactive",
                lines,
            }),
        ).rejects.toThrow("Account account-1 is inactive.");

        expect(journalEntryRepository.create).not.toHaveBeenCalled();
    });

    test("rejects a journal line when its account currency does not match", async () => {
        accountRepository.findAndLockByIds.mockResolvedValue([
            { id: "account-1", status: "ACTIVE", currency: "EUR" },
            { id: "account-2", status: "ACTIVE", currency: "USD" },
        ]);

        await expect(
            useCase.execute({
                idempotencyKey: "request-currency-mismatch",
                lines,
            }),
        ).rejects.toThrow("Account account-1 currency mismatch.");

        expect(journalEntryRepository.create).not.toHaveBeenCalled();
        expect(outboxRepository.add).not.toHaveBeenCalled();
    });
});
