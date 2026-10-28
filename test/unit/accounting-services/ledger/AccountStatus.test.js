import AccountStatus from "../../../../src/conference-management/accounting-services/ledger/domain/aggregates/account/account-status.vo.js";
import {
  AccountInactiveError,
  InvalidArgumentError,
} from "../../../../src/conference-management/accounting-services/ledger/domain/error/index.js";

describe("AccountStatus", () => {
  describe("construction", () => {
    it.each([
      ["ACTIVE", "ACTIVE"],
      [" frozen ", "FROZEN"],
      ["Suspended", "SUSPENDED"],
      ["closed", "CLOSED"],
    ])("normalizes %s to %s", (input, expected) => {
      expect(new AccountStatus(input).value).toBe(expected);
    });

    it("accepts another AccountStatus instance", () => {
      const original = AccountStatus.active();
      const copy = new AccountStatus(original);

      expect(copy.value).toBe("ACTIVE");
      expect(copy).not.toBe(original);
      expect(copy.equals(original)).toBe(true);
    });

    it.each([undefined, null, "", "PENDING", 123, {}])(
      "rejects invalid status %p",
      (input) => {
        expect(() => new AccountStatus(input)).toThrow(
          InvalidArgumentError,
        );
      },
    );

    it("is immutable", () => {
      const status = AccountStatus.active();

      expect(Object.isFrozen(status)).toBe(true);
      expect(() => {
        status._value = "CLOSED";
      }).toThrow(TypeError);

      expect(status.value).toBe("ACTIVE");
    });
  });

  describe("factory methods", () => {
    it.each([
      ["active", AccountStatus.active, "ACTIVE"],
      ["frozen", AccountStatus.frozen, "FROZEN"],
      ["suspended", AccountStatus.suspended, "SUSPENDED"],
      ["closed", AccountStatus.closed, "CLOSED"],
    ])("%s creates the corresponding status", (_name, factory, expected) => {
      expect(factory().value).toBe(expected);
    });
  });

  describe("permissions", () => {
    it.each([
      ["ACTIVE", true, true, true],
      ["FROZEN", false, true, false],
      ["SUSPENDED", false, false, false],
      ["CLOSED", false, false, false],
    ])(
      "%s exposes the correct debit, credit, and hold permissions",
      (value, canDebit, canCredit, canPlaceHold) => {
        const status = new AccountStatus(value);

        expect(status.canDebit()).toBe(canDebit);
        expect(status.canCredit()).toBe(canCredit);
        expect(status.canPlaceHold()).toBe(canPlaceHold);
      },
    );

    it("allows assertions when the operation is permitted", () => {
      expect(() => AccountStatus.active().assertCanDebit()).not.toThrow();
      expect(() => AccountStatus.active().assertCanCredit()).not.toThrow();
      expect(() => AccountStatus.active().assertCanPlaceHold()).not.toThrow();

      expect(() => AccountStatus.frozen().assertCanCredit()).not.toThrow();
    });

    it.each([
      ["FROZEN", "assertCanDebit"],
      ["SUSPENDED", "assertCanDebit"],
      ["CLOSED", "assertCanDebit"],
      ["SUSPENDED", "assertCanCredit"],
      ["CLOSED", "assertCanCredit"],
      ["FROZEN", "assertCanPlaceHold"],
      ["SUSPENDED", "assertCanPlaceHold"],
      ["CLOSED", "assertCanPlaceHold"],
    ])("%s rejects %s", (value, assertion) => {
      const status = new AccountStatus(value);

      expect(() => status[assertion]()).toThrow(AccountInactiveError);
    });
  });

  describe("status transitions", () => {
    it.each([
      ["ACTIVE", "FROZEN", true],
      ["ACTIVE", "SUSPENDED", true],
      ["ACTIVE", "CLOSED", true],
      ["FROZEN", "ACTIVE", true],
      ["FROZEN", "CLOSED", true],
      ["SUSPENDED", "ACTIVE", true],
      ["SUSPENDED", "CLOSED", true],
      ["CLOSED", "ACTIVE", false],
      ["CLOSED", "FROZEN", false],
      ["CLOSED", "SUSPENDED", false],
      ["ACTIVE", "ACTIVE", false],
      ["FROZEN", "SUSPENDED", false],
      ["SUSPENDED", "FROZEN", false],
    ])("%s -> %s is allowed: %s", (current, target, expected) => {
      expect(new AccountStatus(current).canTransitionTo(target)).toBe(
        expected,
      );
    });

    it("accepts an AccountStatus instance as the transition target", () => {
      expect(
        AccountStatus.active().canTransitionTo(AccountStatus.frozen()),
      ).toBe(true);
    });

    it("normalizes target strings to uppercase", () => {
      expect(AccountStatus.active().canTransitionTo("frozen")).toBe(true);
    });

    it("returns false for null, undefined, and unknown targets", () => {
      const status = AccountStatus.active();

      expect(status.canTransitionTo(null)).toBe(false);
      expect(status.canTransitionTo(undefined)).toBe(false);
      expect(status.canTransitionTo("UNKNOWN")).toBe(false);
    });

    it("rejects illegal transitions with InvalidArgumentError", () => {
      expect(() =>
        AccountStatus.closed().assertCanTransitionTo("ACTIVE"),
      ).toThrow(InvalidArgumentError);
    });

    it("accepts a legal transition assertion", () => {
      expect(() =>
        AccountStatus.active().assertCanTransitionTo("FROZEN"),
      ).not.toThrow();
    });
  });

  describe("equality and serialization", () => {
    it("compares equal AccountStatus instances", () => {
      expect(AccountStatus.active().equals(AccountStatus.active())).toBe(true);
      expect(AccountStatus.active().equals(AccountStatus.closed())).toBe(false);
    });

    it("compares strings case-insensitively after trimming", () => {
      expect(AccountStatus.active().equals(" active ")).toBe(true);
      expect(AccountStatus.active().equals("CLOSED")).toBe(false);
    });

    it("returns false for falsy and unsupported comparison values", () => {
      const status = AccountStatus.active();

      expect(status.equals(null)).toBe(false);
      expect(status.equals(undefined)).toBe(false);
      expect(status.equals(123)).toBe(false);
      expect(status.equals({ value: "ACTIVE" })).toBe(false);
    });

    it("supports string conversion and JSON serialization", () => {
      const status = AccountStatus.frozen();

      expect(status.toString()).toBe("FROZEN");
      expect(status.toJSON()).toBe("FROZEN");
      expect(JSON.stringify({ status })).toBe('{"status":"FROZEN"}');
    });
  });
});
