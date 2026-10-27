
/**
 * @file ledger/domain/aggregates/account/account.aggregate.js
 */

import { randomUUID } from "node:crypto";

import { AggregateRoot } from "../../../../../../Shared/domain/AggregateRoot.js";

import {
  InvalidArgumentError,
  InsufficientFundsError,
} from "../../error/index.js";

import AccountStatus from "./account-status.vo.js";
import HoldEntity from "./hold.entity.js";

import {
  AccountHeldEvent,
  AccountReleasedEvent,
} from "../../events/index.js";

export default class AccountAggregate extends AggregateRoot {
  constructor({
    id,
    tenantId,
    accountNumber,
    name,
    currency,
    type = "ASSET",
    status = AccountStatus.ACTIVE,
    postedBalance = 0n,
    holds = [],
    createdAt = new Date(),
  }) {
    if (!id || typeof id !== "string" || id.trim() === "") {
      throw new InvalidArgumentError("Account id is required.");
    }

    // Entity owns the immutable ID; do not assign to this._id afterward.
    super(id);

    this._tenantId = tenantId;
    this._accountNumber = accountNumber;
    this._name = name ?? "";
    this._currency = currency?.toUpperCase();
    this._type = type.toUpperCase();

    this._status =
      status instanceof AccountStatus
        ? status
        : new AccountStatus(status);

    this._postedBalance =
      AccountAggregate.parseMinorUnitsStrict(postedBalance);

    this._holds = new Map();
    this._pendingBalance = 0n;
    this._createdAt = new Date(createdAt);

    for (const hold of holds) {
      const entity =
        hold instanceof HoldEntity
          ? hold
          : new HoldEntity(hold);

      this._holds.set(entity.idempotencyKey, entity);

      if (entity.isActive()) {
        this._pendingBalance += entity.amount;
      }
    }

    this.assertInvariant();
  }

  // Getters

  get status() {
    return this._status;
  }

  get postedBalance() {
    return this._postedBalance;
  }

  get pendingBalance() {
    return this._pendingBalance;
  }

  get availableBalance() {
    return this._postedBalance - this._pendingBalance;
  }

  get holds() {
    return [...this._holds.values()];
  }

  // Domain behaviour

  createHold({
    id = randomUUID(),
    idempotencyKey,
    amount,
    description,
    expiresAt,
  }) {
    this._status.assertCanPlaceHold();

    if (this._holds.has(idempotencyKey)) {
      return {
        hold: this._holds.get(idempotencyKey),
        isDuplicate: true,
      };
    }

    const holdAmount =
      AccountAggregate.parseMinorUnitsStrict(amount);

    if (this.availableBalance < holdAmount) {
      throw new InsufficientFundsError(
        `Available balance ${this.availableBalance} is less than requested ${holdAmount}.`,
      );
    }

    const hold = new HoldEntity({
      id,
      accountId: this.id,
      idempotencyKey,
      amount: holdAmount,
      currency: this._currency,
      description,
      expiresAt,
    });

    this._holds.set(idempotencyKey, hold);
    this._pendingBalance += holdAmount;

    this.assertInvariant();

    this.addDomainEvent(
      new AccountHeldEvent({
        accountId: this.id,
        holdId: hold.id,
        amount: hold.amount,
      }),
    );

    return {
      hold,
      isDuplicate: false,
    };
  }

  releaseHold(idempotencyKey) {
    if (this._status.equals(AccountStatus.CLOSED)) {
      throw new InvalidArgumentError(
        "Cannot release holds from a closed account.",
      );
    }

    const hold = this._holds.get(idempotencyKey);

    if (!hold) {
      throw new InvalidArgumentError(
        `Hold '${idempotencyKey}' not found.`,
      );
    }

    if (hold.isActive()) {
      this._pendingBalance -= hold.amount;
    }

    hold.release();
    this.assertInvariant();

    this.addDomainEvent(
      new AccountReleasedEvent({
        accountId: this.id,
        holdId: hold.id,
      }),
    );
  }

  // Invariants

  assertInvariant() {
    if (this._pendingBalance < 0n) {
      throw new Error("Pending balance cannot be negative.");
    }

    if (this._postedBalance < 0n) {
      throw new Error("Posted balance cannot be negative.");
    }
  }

  // Serialization

  toJSON() {
    return {
      id: this.id,
      tenantId: this._tenantId,
      accountNumber: this._accountNumber,
      name: this._name,
      currency: this._currency,
      type: this._type,
      status: this._status.value,
      postedBalance: this._postedBalance,
      pendingBalance: this._pendingBalance,
      availableBalance: this.availableBalance,
      holds: this.holds.map((hold) => hold.toJSON()),
      createdAt: this._createdAt,
    };
  }

  // Utilities

  static parseMinorUnitsStrict(value) {
    if (typeof value === "bigint") {
      return value;
    }

    if (value === null || value === undefined) {
      return 0n;
    }

    const normalized = String(value).trim();

    if (normalized.includes(".")) {
      throw new InvalidArgumentError(
        "Amount must be expressed in integer minor units.",
      );
    }

    return BigInt(normalized);
  }
}
