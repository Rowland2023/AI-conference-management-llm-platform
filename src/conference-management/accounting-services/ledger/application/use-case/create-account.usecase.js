import { randomUUID } from "node:crypto";

import AccountAggregate from "../../domain/aggregates/account/account.aggregate.js";
import { AccountCreatedEvent } from "../../domain/events/index.js";

export class CreateAccountUseCase {
  constructor({
    accountRepository,
    outboxRepository,
    uow,
    logger,
  }) {
    if (!accountRepository) {
      throw new TypeError("accountRepository is required.");
    }

    if (!uow) {
      throw new TypeError("uow is required.");
    }

    this.accountRepository = accountRepository;
    this.outboxRepository = outboxRepository;
    this.uow = uow;
    this.logger = logger;
  }

  async execute(command) {
    if (!command || typeof command !== "object") {
      throw new TypeError("A valid account command is required.");
    }

    const {
      tenantId,
      code,
      accountNumber = code,
      name,
      currency,
      type = "ASSET",
    } = command;

    if (!tenantId) {
      throw new TypeError("tenantId is required.");
    }

    return this.uow.execute(async (transaction) => {
      const account = new AccountAggregate({
        id: randomUUID(),
        tenantId,
        accountNumber,
        name,
        currency,
        type,
      });

      const savedAccount = await this.accountRepository.save(
        account,
        { transaction },
      );

      if (this.outboxRepository) {
        const event = new AccountCreatedEvent({
          aggregateId: savedAccount.id,
          tenantId,
          accountNumber: savedAccount.toJSON().accountNumber,
          name: savedAccount.toJSON().name,
          currency: savedAccount.toJSON().currency,
          type: savedAccount.toJSON().type,
          status: savedAccount.toJSON().status,
        });

        await this.outboxRepository.save(event, transaction);
      }

      this.logger?.info?.(
        { accountId: savedAccount.id },
        "Ledger account created.",
      );

      return savedAccount;
    });
  }
}
