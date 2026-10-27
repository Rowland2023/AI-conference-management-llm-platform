import { BaseDomainEvent } from "./base-domain.event.js";

export class AccountCreatedEvent extends BaseDomainEvent {
  constructor({
    aggregateId,
    tenantId,
    accountNumber,
    name,
    currency,
    type,
    status,
  }) {
    super({
      eventName: "account.created",
      aggregateId,
      payload: {
        tenantId,
        accountNumber,
        name,
        currency,
        type,
        status,
      },
    });
  }
}
