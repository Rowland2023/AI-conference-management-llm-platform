
import { CreateAccountUseCase } from "../../../../src/conference-management/accounting-services/ledger/application/use-case/create-account.usecase.js";
import { jest } from "@jest/globals";
describe("CreateAccountUseCase", () => {
  let accountRepository;
  let outboxRepository;
  let uow;
  let logger;
  let useCase;

  const command = {
    tenantId: "tenant-1",
    code: "CASH-001",
    name: "Cash Account",
    currency: "USD",
    type: "ASSET",
    createdBy: "user-1",
  };

  beforeEach(() => {
    accountRepository = {
      save: jest.fn(async (account) => account),
    };

    outboxRepository = {
      save: jest.fn().mockResolvedValue(undefined),
    };

    uow = {
      execute: jest.fn(async (callback) =>
        callback({ transaction: true }),
      ),
    };

    logger = { info: jest.fn() };

    useCase = new CreateAccountUseCase({
      accountRepository,
      outboxRepository,
      uow,
      logger,
    });
  });

  test("creates an account with a generated ID and persists it transactionally", async () => {
    const result = await useCase.execute(command);

    expect(result.id).toEqual(expect.any(String));
    expect(result.toJSON()).toEqual(
      expect.objectContaining({
        tenantId: command.tenantId,
        accountNumber: command.code,
        name: command.name,
        currency: command.currency,
        type: command.type,
      }),
    );

    expect(accountRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: result.id,
        toJSON: expect.any(Function),
      }),
      { transaction: { transaction: true } },
    );

    const [event, transaction] = outboxRepository.save.mock.calls[0];

    expect(event.eventName).toBe("account.created");
    expect(event.aggregateId).toBe(result.id);
    expect(transaction).toEqual({ transaction: true });

    expect(logger.info).toHaveBeenCalled();
  });

  test("rejects a command without tenantId before starting a transaction", async () => {
    await expect(
      useCase.execute({ ...command, tenantId: undefined }),
    ).rejects.toThrow("tenantId is required.");

    expect(uow.execute).not.toHaveBeenCalled();
    expect(accountRepository.save).not.toHaveBeenCalled();
  });

  test("propagates an account persistence failure", async () => {
    accountRepository.save.mockRejectedValue(
      new Error("Account persistence failed"),
    );

    await expect(useCase.execute(command)).rejects.toThrow(
      "Account persistence failed",
    );

    expect(outboxRepository.save).not.toHaveBeenCalled();
  });

  test("propagates an outbox failure so the transaction can roll back", async () => {
    outboxRepository.save.mockRejectedValue(
      new Error("Outbox persistence failed"),
    );

    await expect(useCase.execute(command)).rejects.toThrow(
      "Outbox persistence failed",
    );
  });

  test("creates an account when no outbox repository is configured", async () => {
    useCase = new CreateAccountUseCase({
      accountRepository,
      uow,
      logger,
    });

    const result = await useCase.execute(command);

    expect(result.id).toEqual(expect.any(String));
    expect(accountRepository.save).toHaveBeenCalledTimes(1);
  });
});

