
import { describe, expect, it } from "@jest/globals";

import Money from "../../../../src/conference-management/accounting-services/ledger/domain/value-objects/money.vo.js";
import { InvalidArgumentError } from "../../../../src/conference-management/accounting-services/ledger/domain/error/index.js";

describe("Money", () => {
  describe("constructor", () => {
    it("stores an integer amount as BigInt and normalizes currency", () => {
      const money = new Money("1050", " usd ");

      expect(money.amount).toBe(1050n);
      expect(money.currency).toBe("USD");
    });

    it("accepts a BigInt amount", () => {
      expect(new Money(1050n, "NGN").amount).toBe(1050n);
    });

    it("allows negative amounts for signed accounting values", () => {
      expect(new Money(-250n, "NGN").amount).toBe(-250n);
    });

    it("rejects missing or malformed currencies", () => {
      for (const currency of [null, undefined, "", "US", "USDD", "1$A"]) {
        expect(() => new Money(100n, currency))
          .toThrow(InvalidArgumentError);
      }
    });

    it("rejects decimal amounts", () => {
      for (const amount of ["10.50", 10.5, "abc", ""]) {
        expect(() => new Money(amount, "USD"))
          .toThrow(InvalidArgumentError);
      }
    });

    it("rejects missing amounts", () => {
      for (const amount of [null, undefined]) {
        expect(() => new Money(amount, "USD"))
          .toThrow(InvalidArgumentError);
      }
    });

    it("rejects unsafe JavaScript integer inputs", () => {
      expect(() => new Money(Number.MAX_SAFE_INTEGER + 1, "USD"))
        .toThrow(InvalidArgumentError);
    });

    it("is immutable", () => {
      const money = new Money(100n, "USD");

      expect(Object.isFrozen(money)).toBe(true);
      expect(() => {
        money._amount = 200n;
      }).toThrow();
    });
  });

  describe("parseMinorUnitsStrict", () => {
    it("parses integer strings without losing precision", () => {
      expect(Money.parseMinorUnitsStrict("9007199254740993"))
        .toBe(9007199254740993n);
    });

    it("rejects non-integer and missing values", () => {
      for (const value of [null, undefined, "", "1.25", "abc", 1.25]) {
        expect(() => Money.parseMinorUnitsStrict(value))
          .toThrow(InvalidArgumentError);
      }
    });
  });

  describe("assertPositive", () => {
    it("returns a positive amount as BigInt", () => {
      expect(Money.assertPositive("100")).toBe(100n);
    });

    it("rejects zero and negative amounts", () => {
      for (const amount of [0n, -1n, "0", "-10"]) {
        expect(() => Money.assertPositive(amount))
          .toThrow(InvalidArgumentError);
      }
    });
  });
});
