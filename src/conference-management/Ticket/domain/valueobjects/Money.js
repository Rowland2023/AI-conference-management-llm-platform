
// src/conference-management/ticket/domain/valueobjects/Money.js

export class Money {
  constructor(amount, currency = "USD") {
    const numericAmount = Number(amount);

    if (
      amount === undefined ||
      amount === null ||
      (typeof amount === "string" && amount.trim() === "") ||
      !Number.isFinite(numericAmount) ||
      numericAmount < 0
    ) {
      throw new Error(
        "Money amount must be a finite, non-negative number."
      );
    }

    if (
      typeof currency !== "string" ||
      !/^[A-Za-z]{3}$/.test(currency.trim())
    ) {
      throw new Error("Currency must be a valid three-letter code.");
    }

    this.amount = numericAmount;
    this.currency = currency.trim().toUpperCase();

    Object.freeze(this);
  }

  /**
   * Add another monetary amount in the same currency.
   */
  add(other) {
    this.#assertSameCurrency(other);

    return new Money(
      this.amount + other.amount,
      this.currency
    );
  }

  /**
   * Subtract another monetary amount.
   * Negative balances are rejected by this value object.
   */
  subtract(other) {
    this.#assertSameCurrency(other);

    if (other.amount > this.amount) {
      throw new Error("Money amount cannot be negative.");
    }

    return new Money(
      this.amount - other.amount,
      this.currency
    );
  }

  /**
   * Multiply by a positive integer quantity.
   * Used by Ticket.confirmPurchase().
   */
  multiply(quantity) {
    if (
      !Number.isSafeInteger(quantity) ||
      quantity <= 0
    ) {
      throw new Error(
        "Quantity must be a positive safe integer."
      );
    }

    const result = this.amount * quantity;

    if (!Number.isFinite(result)) {
      throw new Error("Money multiplication overflow.");
    }

    return new Money(result, this.currency);
  }

  /**
   * Compare monetary values.
   */
  equals(other) {
    return (
      other instanceof Money &&
      this.amount === other.amount &&
      this.currency === other.currency
    );
  }

  /**
   * Currency-safe comparison helpers.
   */
  isGreaterThan(other) {
    this.#assertSameCurrency(other);
    return this.amount > other.amount;
  }

  isLessThan(other) {
    this.#assertSameCurrency(other);
    return this.amount < other.amount;
  }

  /**
   * Return a serializable representation.
   */
  toJSON() {
    return {
      amount: this.amount,
      currency: this.currency,
    };
  }

  #assertSameCurrency(other) {
    if (!(other instanceof Money)) {
      throw new TypeError("Expected a Money instance.");
    }

    if (this.currency !== other.currency) {
      throw new Error(
        `Currency mismatch: ${this.currency} and ${other.currency}.`
      );
    }
  }
}
