/**
 * @file domain/RefundStatus.js

 * @description Immutable Value Object and State Machine governing refund lifecycle.

 * @description Value Object and State Machine governing valid refund state transitions.

 */

const STATES = Object.freeze({
  REQUESTED: "REQUESTED",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  REJECTED: "REJECTED",
});


const STATE_VALUES = Object.freeze(Object.values(STATES));

const VALID_TRANSITIONS = Object.freeze({
  [STATES.REQUESTED]: Object.freeze([

// Explicit State Transition Map
const VALID_TRANSITIONS = Object.freeze({
  [STATES.REQUESTED]: [

    STATES.PENDING_APPROVAL,
    STATES.PROCESSING,
    STATES.REJECTED,
    STATES.FAILED,
 clean-D2
  ]),

  [STATES.PENDING_APPROVAL]: Object.freeze([
    STATES.PROCESSING,
    STATES.REJECTED,
    STATES.FAILED,
  ]),

  [STATES.PROCESSING]: Object.freeze([
    STATES.COMPLETED,
    STATES.FAILED,
  ]),

  [STATES.COMPLETED]: Object.freeze([]),

  [STATES.FAILED]: Object.freeze([
    STATES.PROCESSING,
  ]),

  [STATES.REJECTED]: Object.freeze([]),
});

export default class RefundStatus {
  constructor(value) {
    if (!RefundStatus.isValid(value)) {
      throw new Error(
        `[RefundStatus] Invalid refund status "${value}".`
      );
    }

    this.value = value;

  ],

  [STATES.PENDING_APPROVAL]: [
    STATES.PROCESSING,
    STATES.REJECTED,
    STATES.FAILED,
  ],

  [STATES.PROCESSING]: [
    STATES.COMPLETED,
    STATES.FAILED,
  ],

  [STATES.COMPLETED]: [],

  [STATES.FAILED]: [
    STATES.PROCESSING,
  ],

  [STATES.REJECTED]: [],
});


class RefundStatus {

  constructor(status) {

    if (!Object.values(STATES).includes(status)) {
      throw new Error(
        `[RefundStatus] Invalid refund status: "${status}"`
      );
    }

    this.value = status;


    Object.freeze(this);
  }
  /* ------------------------------------------------------------------ */
  /* Factory Methods                                                    */
  /* ------------------------------------------------------------------ */

  static from(value) {
    return value instanceof RefundStatus
      ? value
      : new RefundStatus(value);
  }

  static isValid(value) {
    return STATE_VALUES.includes(value);
  }

  static values() {
    return [...STATE_VALUES];
  }

  /* ------------------------------------------------------------------ */
  /* State Machine                                                      */
  /* ------------------------------------------------------------------ */

  canTransitionTo(nextStatus) {
    const next =
      nextStatus instanceof RefundStatus
        ? nextStatus.value
        : nextStatus;

    return (
      VALID_TRANSITIONS[this.value] ?? []
    ).includes(next);
  }

  transitionTo(nextStatus) {
    const next =
      nextStatus instanceof RefundStatus
        ? nextStatus.value
        : nextStatus;

    if (!this.canTransitionTo(next)) {
      throw new Error(
        `[RefundStatus] Invalid transition from "${this.value}" to "${next}".`
      );
    }

    return new RefundStatus(next);
  }

  isTerminal() {
    return (
      this.value === STATES.COMPLETED ||
      this.value === STATES.REJECTED
    );
  }

  equals(other) {
    return (
      other instanceof RefundStatus
        ? this.value === other.value
        : this.value === other
    );
  }

  toString() {
    return this.value;
  }

  toJSON() {
    return this.value;
  }
}

/* -------------------------------------------------------------------- */
/* Static Enum Constants                                                */
/* -------------------------------------------------------------------- */

Object.defineProperties(RefundStatus, {
  REQUESTED: {
    value: STATES.REQUESTED,
    enumerable: true,
  },
  PENDING_APPROVAL: {
    value: STATES.PENDING_APPROVAL,
    enumerable: true,
  },
  PROCESSING: {
    value: STATES.PROCESSING,
    enumerable: true,
  },
  COMPLETED: {
    value: STATES.COMPLETED,
    enumerable: true,
  },
  FAILED: {
    value: STATES.FAILED,
    enumerable: true,
  },
  REJECTED: {
    value: STATES.REJECTED,
    enumerable: true,
  },
});

Object.freeze(RefundStatus);


  // Enum Expository Constants

  static get REQUESTED() {
    return STATES.REQUESTED;
  }

  static get PENDING_APPROVAL() {
    return STATES.PENDING_APPROVAL;
  }

  static get PROCESSING() {
    return STATES.PROCESSING;
  }

  static get COMPLETED() {
    return STATES.COMPLETED;
  }

  static get FAILED() {
    return STATES.FAILED;
  }

  static get REJECTED() {
    return STATES.REJECTED;
  }


  /**
   * Asserts whether transitioning to a target state is valid.
   *
   * @param {string} nextStatus
   * @returns {boolean}
   */
  canTransitionTo(nextStatus) {

    const allowed =
      VALID_TRANSITIONS[this.value] || [];

    return allowed.includes(nextStatus);
  }


  /**
   * Enforces transition rules and returns a new status instance.
   *
   * @param {string} nextStatus
   * @returns {RefundStatus}
   */
  transitionTo(nextStatus) {

    if (!this.canTransitionTo(nextStatus)) {
      throw new Error(
        `[RefundStatus] Invalid transition from "${this.value}" to "${nextStatus}".`
      );
    }

    return new RefundStatus(nextStatus);
  }


  /**
   * Checks if the current state is final/immutable.
   *
   * @returns {boolean}
   */
  isTerminal() {

    return [
      STATES.COMPLETED,
      STATES.REJECTED,
    ].includes(this.value);
  }


  equals(other) {

    if (other instanceof RefundStatus) {
      return this.value === other.value;
    }

    return this.value === other;
  }


  toString() {

    return this.value;
  }

}


// Preserve enum-style compatibility
// Usage:
// RefundStatus.REQUESTED
// RefundStatus.PROCESSING
Object.assign(
  RefundStatus,
  STATES
);


export default RefundStatus;

