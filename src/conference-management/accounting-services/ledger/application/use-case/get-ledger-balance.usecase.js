/**
 * @file get-ledger-balance.usecase.js
 *
 * Retrieves an account's posted ledger balance as of a specific date.
 * Pending and available balances are not calculated until hold accounting
 * is backed by a verified persistence schema.
 */

import {
  ValidationError,
  NotFoundError,
} from "../../../../../Shared/application/errors/ApplicationErrors.js";

const toBigIntStrict = (value, fieldName) => {
  if (typeof value === "bigint") {
    return value;
  }

  if (
    typeof value === "number" &&
    Number.isSafeInteger(value)
  ) {
    return BigInt(value);
  }

  if (
    typeof value === "string" &&
    /^-?\d+$/.test(value.trim())
  ) {
    return BigInt(value.trim());
  }

  throw new TypeError(
    `${fieldName} must be an integer amount in minor units.`
  );
};

export class GetLedgerBalanceUseCase {
  constructor({
    accountRepository,
    journalEntryRepository,
    logger,
    metrics,
  }) {
    this.accountRepository = accountRepository;
    this.journalEntryRepository = journalEntryRepository;
    this.logger = logger;
    this.metrics = metrics;
  }

  async execute({
    tenantId,
    accountId,
    currency,
    asOfDate,
    requestedBy,
  }) {
    this.validateInput({
      tenantId,
      accountId,
      asOfDate,
    });

    if (
      !this.journalEntryRepository ||
      typeof this.journalEntryRepository.calculateAccountBalance !==
        "function"
    ) {
      throw new Error(
        "Ledger balance repository is not configured."
      );
    }

    const effectiveDate = asOfDate
      ? new Date(asOfDate)
      : new Date();

    const account = await this.loadAccount(
      tenantId,
      accountId
    );

    const targetCurrency = this.resolveCurrency(
      account,
      currency
    );

    const balances =
      await this.journalEntryRepository.calculateAccountBalance({
        tenantId,
        accountId: account.id,
        currency: targetCurrency,
        asOfDate: effectiveDate,
        accountType: account.type,
      });

    const postedBalance = toBigIntStrict(
      balances?.postedBalance,
      "postedBalance"
    );

    this.recordMetrics({
      account,
      currency: targetCurrency,
      asOfDate: effectiveDate,
      requestedBy,
    });

    return {
      accountId: account.id,
      accountName: account.name,
      currency: targetCurrency,
      balance: postedBalance.toString(),
      pendingBalance: null,
      availableBalance: null,
      asOf: effectiveDate.toISOString(),
    };
  }

  validateInput({ tenantId, accountId, asOfDate }) {
    if (
      typeof tenantId !== "string" ||
      tenantId.trim() === ""
    ) {
      throw new ValidationError(
        "tenantId must be a valid string."
      );
    }

    if (
      typeof accountId !== "string" ||
      accountId.trim() === ""
    ) {
      throw new ValidationError(
        "accountId must be a valid string."
      );
    }

    if (asOfDate !== undefined && asOfDate !== null) {
      const date = new Date(asOfDate);

      if (Number.isNaN(date.getTime())) {
        throw new ValidationError(
          "asOfDate must be a valid date."
        );
      }

      if (date > new Date()) {
        throw new ValidationError(
          "asOfDate cannot be in the future."
        );
      }
    }
  }

  async loadAccount(tenantId, accountId) {
    const account = await this.accountRepository.findById(
      tenantId,
      accountId
    );

    if (!account) {
      throw new NotFoundError(
        `Account '${accountId}' not found.`
      );
    }

    if (
      account.status &&
      account.status !== "ACTIVE"
    ) {
      throw new ValidationError(
        `Account '${accountId}' is ${account.status}.`
      );
    }

    return account;
  }

  resolveCurrency(account, requestedCurrency) {
    const currency = (
      requestedCurrency ?? account.currency
    )?.toUpperCase();

    if (
      typeof currency !== "string" ||
      currency.trim() === ""
    ) {
      throw new ValidationError(
        "A valid currency is required."
      );
    }

    if (
      account.currency &&
      currency !== account.currency.toUpperCase()
    ) {
      throw new ValidationError(
        `Currency mismatch. Account currency is ${account.currency}.`
      );
    }

    return currency;
  }

  recordMetrics({
    account,
    currency,
    asOfDate,
    requestedBy,
  }) {
    const actor =
      typeof requestedBy === "object"
        ? requestedBy?.id ?? requestedBy?.userId
        : requestedBy;

    this.logger?.info({
      event: "LEDGER_BALANCE_CHECKED",
      accountId: account.id,
      currency,
      asOf: asOfDate.toISOString(),
      requestedBy: actor ?? "SYSTEM",
    });

    this.metrics?.increment(
      "ledger.balance.checked",
      1,
      { currency }
    );
  }
}
