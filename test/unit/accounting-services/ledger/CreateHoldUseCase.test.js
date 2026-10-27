import { CreateHoldUseCase } from "../../../../src/conference-management/accounting-services/ledger/application/use-case/create-hold.usecase.js";
import { jest } from "@jest/globals";

describe("CreateHoldUseCase", () => {
    let holdRepository;
    let accountRepository;
    let journalEntryRepository;
    let unitOfWork;
    let logger;
    let metrics;
    let useCase;

    const account = {
        id: "account-1",
        status: "ACTIVE",
        currency: "USD",
    };

    const command = {
        idempotencyKey: "hold-request-1",
        accountId: "account-1",
        amount: "500",
        currency: "USD",
        description: "Test hold",
    };

    beforeEach(() => {
        holdRepository = {
            findByIdempotencyKey: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation(async (data) => ({
                id: "hold-123",
                ...data,
            })),
        };

        accountRepository = {
            findAndLockByIds: jest.fn().mockResolvedValue([account]),
        };

        journalEntryRepository = {
            calculateAccountBalance: jest.fn().mockResolvedValue({
                postedBalance: "1000",
                pendingBalance: "100",
            }),
        };

        unitOfWork = {
            execute: jest.fn(async (callback) => callback({ transaction: true })),
        };

        logger = { info: jest.fn() };
        metrics = { increment: jest.fn() };

        useCase = new CreateHoldUseCase({
            holdRepository,
            accountRepository,
            journalEntryRepository,
            unitOfWork,
            logger,
            metrics,
        });
    });

    test("returns an existing hold for a duplicate idempotency key", async () => {
        const existing = { id: "hold-existing", status: "ACTIVE" };
        holdRepository.findByIdempotencyKey.mockResolvedValue(existing);

        const result = await useCase.execute(command);

        expect(result).toEqual({ ...existing, isDuplicate: true });
        expect(unitOfWork.execute).not.toHaveBeenCalled();
        expect(holdRepository.create).not.toHaveBeenCalled();
    });

    test("rejects a hold amount that is not positive", async () => {
        await expect(
            useCase.execute({ ...command, amount: "0" }),
        ).rejects.toThrow("Hold amount must be greater than zero");

        expect(unitOfWork.execute).not.toHaveBeenCalled();
    });

    test("rejects a hold when available funds are insufficient", async () => {
        journalEntryRepository.calculateAccountBalance.mockResolvedValue({
            postedBalance: "500",
            pendingBalance: "100",
        });

        await expect(
            useCase.execute({ ...command, amount: "401" }),
        ).rejects.toThrow(/Available 400 < Requested 401/);

        expect(holdRepository.create).not.toHaveBeenCalled();
    });

    test("rejects a missing account", async () => {
        accountRepository.findAndLockByIds.mockResolvedValue([]);

        await expect(
            useCase.execute(command),
        ).rejects.toThrow("Account account-1 not found");

        expect(holdRepository.create).not.toHaveBeenCalled();
    });

    test("rejects a currency mismatch", async () => {
        await expect(
            useCase.execute({ ...command, currency: "EUR" }),
        ).rejects.toThrow(/Currency mismatch/);

        expect(holdRepository.create).not.toHaveBeenCalled();
    });

    test("rejects an expiry date in the past", async () => {
        await expect(
            useCase.execute({
                ...command,
                expiresAt: "2000-01-01T00:00:00.000Z",
            }),
        ).rejects.toThrow("expiresAt must be in the future");

        expect(unitOfWork.execute).not.toHaveBeenCalled();
    });

    test("creates a hold when sufficient funds are available", async () => {
        const result = await useCase.execute(command);

        expect(result).toEqual(
            expect.objectContaining({
                id: "hold-123",
                accountId: "account-1",
                amount: "500",
                currency: "USD",
                status: "ACTIVE",
                isDuplicate: false,
            }),
        );

        expect(accountRepository.findAndLockByIds).toHaveBeenCalledWith(
            ["account-1"],
            { session: { transaction: true } },
        );

        expect(journalEntryRepository.calculateAccountBalance).toHaveBeenCalledWith(
            { accountId: "account-1", currency: "USD" },
            { session: { transaction: true } },
        );

        expect(holdRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({
                idempotencyKey: "hold-request-1",
                amount: "500",
                currency: "USD",
                status: "ACTIVE",
            }),
            { session: { transaction: true } },
        );

        expect(logger.info).toHaveBeenCalled();
        expect(metrics.increment).toHaveBeenCalledWith(
            "ledger.hold.created",
            1,
            { currency: "USD" },
        );
    });
});
