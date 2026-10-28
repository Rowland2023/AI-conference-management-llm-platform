import { jest } from "@jest/globals";

import AccountAggregate from "../../../../src/conference-management/accounting-services/ledger/domain/aggregates/account/account.aggregate.js";
import AccountStatus from "../../../../src/conference-management/accounting-services/ledger/domain/aggregates/account/account-status.vo.js";
import HoldEntity from "../../../../src/conference-management/accounting-services/ledger/domain/aggregates/account/hold.entity.js";
import {
  InvalidArgumentError,
  InsufficientFundsError,
} from "../../../../src/conference-management/accounting-services/ledger/domain/error/index.js";

describe("AccountAggregate", () => {
  const makeAccount = (overrides = {}) =>
    new AccountAggregate({
      id: "account-1",
      tenantId: "tenant-1",
      accountNumber: "10001",
      name: "Operating account",
      currency: "USD",
      postedBalance: 1000n,
      ...overrides,
    });

  describe("construction", () => {
    test("initializes account details and default values", () => {
      const account = makeAccount();

      expect(account.id).toBe("account-1");
      expect(account.status).toBeInstanceOf(AccountStatus);
      expect(account.status.value).toBe("ACTIVE");
      expect(account.postedBalance).toBe(1000n);
      expect(account.pendingBalance).toBe(0n);
      expect(account.availableBalance).toBe(1000n);
      expect(account.holds).toEqual([]);
    });

    test.each([undefined, null, "", "   ", 123])(
      "rejects invalid account id: %p",
      (id) => {
        expect(() => makeAccount({ id })).toThrow(InvalidArgumentError);
      },
    );

    test("normalizes currency and account type", () => {
      const account = makeAccount({
        currency: "usd",
        type: "liability",
      });

      expect(account.toJSON()).toEqual(
        expect.objectContaining({
          currency: "USD",
          type: "LIABILITY",
        }),
      );
    });

    test("accepts an AccountStatus instance", () => {
      const status = AccountStatus.frozen();
      const account = makeAccount({ status });

      expect(account.status).toBe(status);
    });

    test("converts a status string to AccountStatus", () => {
      const account = makeAccount({ status: "frozen" });

      expect(account.status.value).toBe("FROZEN");
    });

    test("rejects a negative posted balance", () => {
      expect(() => makeAccount({ postedBalance: -1n })).toThrow(
        "Posted balance cannot be negative.",
      );
    });

    test("calculates pending balance from active initial holds", () => {
      const account = makeAccount({
        holds: [
          {
            id: "hold-1",
            accountId: "account-1",
            idempotencyKey: "key-1",
            amount: 100n,
            currency: "USD",
          },
          new HoldEntity({
            id: "hold-2",
            accountId: "account-1",
            idempotencyKey: "key-2",
            amount: 200n,
            currency: "USD",
            status: HoldEntity.STATUS.RELEASED,
          }),
        ],
      });

      expect(account.holds).toHaveLength(2);
      expect(account.pendingBalance).toBe(100n);
      expect(account.availableBalance).toBe(900n);
    });

    
test("rejects initial active holds whose total exceeds the posted balance", () => {
  expect(() =>
    makeAccount({
      postedBalance: 100n,
      holds: [
        {
          accountId: "account-1",
          idempotencyKey: "key-1",
          amount: 80n,
          currency: "USD",
        },
        {
          accountId: "account-1",
          idempotencyKey: "key-2",
          amount: 50n,
          currency: "USD",
        },
      ],
    }),
  ).toThrow("Pending balance cannot exceed posted balance.");
});

  });

  describe("parseMinorUnitsStrict", () => {
    test.each([
      [100n, 100n],
      [" 250 ", 250n],
      [0, 0n],
      [undefined, 0n],
      [null, 0n],
    ])("parses %p into %p", (value, expected) => {
      expect(AccountAggregate.parseMinorUnitsStrict(value)).toBe(expected);
    });

    test("rejects decimal amounts", () => {
      expect(() =>
        AccountAggregate.parseMinorUnitsStrict("10.50"),
      ).toThrow(InvalidArgumentError);
    });

    test("rejects invalid integer strings", () => {
      expect(() =>
        AccountAggregate.parseMinorUnitsStrict("not-an-amount"),
      ).toThrow();
    });
  });

  describe("createHold", () => {
    test("creates a hold and updates balances", () => {
      const account = makeAccount();

      const result = account.createHold({
        id: "hold-1",
        idempotencyKey: "request-1",
        amount: 250n,
        description: "Conference reservation",
      });

      expect(result.isDuplicate).toBe(false);
      expect(result.hold).toBeInstanceOf(HoldEntity);
      expect(result.hold.id).toBe("hold-1");
      expect(result.hold.amount).toBe(250n);
      expect(account.pendingBalance).toBe(250n);
      expect(account.availableBalance).toBe(750n);
    });

    test("returns the existing hold for a duplicate idempotency key", () => {
      const account = makeAccount();

      const first = account.createHold({
        id: "hold-1",
        idempotencyKey: "request-1",
        amount: 250n,
      });

      const second = account.createHold({
        id: "hold-2",
        idempotencyKey: "request-1",
        amount: 400n,
      });

      expect(second).toEqual({
        hold: first.hold,
        isDuplicate: true,
      });
      expect(account.holds).toHaveLength(1);
      expect(account.pendingBalance).toBe(250n);
    });

    test("rejects a hold when available funds are insufficient", () => {
      const account = makeAccount({
        postedBalance: 500n,
        holds: [
          {
            accountId: "account-1",
            idempotencyKey: "existing",
            amount: 200n,
            currency: "USD",
          },
        ],
      });

      expect(() =>
        account.createHold({
          idempotencyKey: "new-request",
          amount: 301n,
        }),
      ).toThrow(InsufficientFundsError);

      expect(account.pendingBalance).toBe(200n);
      expect(account.availableBalance).toBe(300n);
      expect(account.holds).toHaveLength(1);
    });

    test.each(["FROZEN", "SUSPENDED", "CLOSED"])(
      "rejects hold creation for a %s account",
      (status) => {
        const account = makeAccount({ status });

        expect(() =>
          account.createHold({
            idempotencyKey: "request-1",
            amount: 100n,
          }),
        ).toThrow();
      },
    );

    test("records an AccountHeldEvent with the required payload", () => {
      const account = makeAccount();

      account.createHold({
        id: "hold-1",
        idempotencyKey: "request-1",
        amount: 250n,
      });

      const events = account.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe("account.held");
      expect(events[0].payload).toEqual(
        expect.objectContaining({
          accountId: "account-1",
          holdId: "hold-1",
          idempotencyKey: "request-1",
          amount: "250",
          currency: "USD",
        }),
      );
    });
  });

  describe("releaseHold", () => {
    test("releases an active hold and records an event", () => {
      const account = makeAccount();

      account.createHold({
        id: "hold-1",
        idempotencyKey: "request-1",
        amount: 250n,
      });

      account.clearDomainEvents();
      account.releaseHold("request-1");

      expect(account.holds[0].status).toBe(HoldEntity.STATUS.RELEASED);
      expect(account.pendingBalance).toBe(0n);
      expect(account.availableBalance).toBe(1000n);

      const events = account.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe("account.released");
      expect(events[0].payload).toEqual(
        expect.objectContaining({
          accountId: "account-1",
          holdId: "hold-1",
          releasedAmount: "250",
        }),
      );
    });

    test("rejects releasing a missing hold", () => {
      const account = makeAccount();

      expect(() => account.releaseHold("missing")).toThrow(
        InvalidArgumentError,
      );
    });

    test("rejects releasing a hold from a closed account", () => {
      const account = makeAccount({ status: "CLOSED" });

      expect(() => account.releaseHold("missing")).toThrow(
        InvalidArgumentError,
      );
    });

    test("does not corrupt the pending balance when release fails", () => {
      const account = makeAccount({
        holds: [
          {
            id: "hold-1",
            accountId: "account-1",
            idempotencyKey: "request-1",
            amount: 250n,
            currency: "USD",
            expiresAt: new Date("2000-01-01T00:00:00.000Z"),
          },
        ],
      });

      expect(() => account.releaseHold("request-1")).toThrow();
      expect(account.pendingBalance).toBe(250n);
    });
  });

  describe("domain events and serialization", () => {
    test("pullDomainEvents returns and clears pending events", () => {
      const account = makeAccount();

      account.createHold({
        id: "hold-1",
        idempotencyKey: "request-1",
        amount: 250n,
      });

      const events = account.pullDomainEvents();

      expect(events).toHaveLength(1);
      expect(account.getDomainEvents()).toEqual([]);
      expect(account.hasDomainEvents()).toBe(false);
    });

    test("serializes account details, balances, and holds", () => {
      const account = makeAccount({
        createdAt: "2025-01-01T00:00:00.000Z",
      });

      const result = account.toJSON();

      expect(result).toEqual(
        expect.objectContaining({
          id: "account-1",
          tenantId: "tenant-1",
          accountNumber: "10001",
          name: "Operating account",
          currency: "USD",
          type: "ASSET",
          status: "ACTIVE",
          postedBalance: 1000n,
          pendingBalance: 0n,
          availableBalance: 1000n,
          holds: [],
          createdAt: new Date("2025-01-01T00:00:00.000Z"),
        }),
      );
    });
  });
});
