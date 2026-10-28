import HoldEntity from "../../../../src/conference-management/accounting-services/ledger/domain/aggregates/account/hold.entity.js";
import {
  InvalidArgumentError,
  InvalidStateError,
} from "../../../../src/conference-management/accounting-services/ledger/domain/error/index.js";

describe("HoldEntity", () => {
  const createHold = (overrides = {}) =>
    new HoldEntity({
      id: "hold-1",
      accountId: "account-1",
      idempotencyKey: "hold-key-1",
      amount: 5000n,
      currency: "ngn",
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      expiresAt: new Date("2026-01-01T11:00:00.000Z"),
      ...overrides,
    });

  describe("construction and validation", () => {
    it("normalizes currency and amount", () => {
      const hold = createHold();

      expect(hold.id).toBe("hold-1");
      expect(hold.accountId).toBe("account-1");
      expect(hold.idempotencyKey).toBe("hold-key-1");
      expect(hold.amount).toBe(5000n);
      expect(hold.currency).toBe("NGN");
      expect(hold.status).toBe(HoldEntity.STATUS.ACTIVE);
    });

    it("rejects a missing account ID", () => {
      expect(
        () => createHold({ accountId: "" }),
      ).toThrow(InvalidArgumentError);
    });

    it("rejects a missing idempotency key", () => {
      expect(
        () => createHold({ idempotencyKey: "" }),
      ).toThrow(InvalidArgumentError);
    });

    it("rejects a missing amount", () => {
      expect(
        () => createHold({ amount: undefined }),
      ).toThrow("Amount is required.");
    });

    it("rejects decimal amounts instead of silently accepting major units", () => {
      expect(
        () => createHold({ amount: "50.00" }),
      ).toThrow("Amount must be integer minor units.");
    });

    it("rejects an invalid status", () => {
      expect(
        () => createHold({ status: "pending" }),
      ).toThrow(InvalidArgumentError);
    });

    it("normalizes a valid status", () => {
      const hold = createHold({ status: " released " });

      expect(hold.status).toBe(HoldEntity.STATUS.RELEASED);
      expect(hold.isReleased()).toBe(true);
    });

    it("accepts bigint and integer-string minor units", () => {
      expect(createHold({ amount: 123n }).amount).toBe(123n);
      expect(createHold({ amount: "456" }).amount).toBe(456n);
    });
  });

  describe("lifecycle queries", () => {
    const now = new Date("2026-01-01T11:00:00.000Z");

    it("reports an active, unexpired hold as reservable", () => {
      const hold = createHold({
        expiresAt: new Date("2026-01-01T11:00:01.000Z"),
      });

      expect(hold.isActive()).toBe(true);
      expect(hold.isExpired(now)).toBe(false);
      expect(hold.canReserve(now)).toBe(true);
    });

    it("considers a hold expired at its exact expiry time", () => {
      const hold = createHold({ expiresAt: now });

      expect(hold.isExpired(now)).toBe(true);
      expect(hold.canReserve(now)).toBe(false);
      expect(hold.status).toBe(HoldEntity.STATUS.ACTIVE);
    });

    it("does not expire a hold without an expiry date", () => {
      const hold = createHold({ expiresAt: null });

      expect(hold.isExpired(now)).toBe(false);
      expect(hold.canReserve(now)).toBe(true);
    });

    it("identifies released and captured statuses", () => {
      expect(createHold({ status: "RELEASED" }).isReleased()).toBe(true);
      expect(createHold({ status: "CAPTURED" }).isCaptured()).toBe(true);
      expect(createHold({ status: "RELEASED" }).isActive()).toBe(false);
    });
  });

  describe("lifecycle commands", () => {
    const beforeExpiry = new Date("2026-01-01T10:30:00.000Z");
    const afterExpiry = new Date("2026-01-01T11:30:00.000Z");

    it("releases an active, unexpired hold", () => {
      const hold = createHold();

      hold.release(beforeExpiry);

      expect(hold.status).toBe(HoldEntity.STATUS.RELEASED);
      expect(hold.isReleased()).toBe(true);
    });

    it("captures an active, unexpired hold", () => {
      const hold = createHold();

      hold.capture(beforeExpiry);

      expect(hold.status).toBe(HoldEntity.STATUS.CAPTURED);
      expect(hold.isCaptured()).toBe(true);
    });

    it("rejects releasing an expired hold", () => {
      const hold = createHold();

      expect(() => hold.release(afterExpiry)).toThrow(InvalidStateError);
      expect(hold.status).toBe(HoldEntity.STATUS.ACTIVE);
    });

    it("rejects capturing an expired hold", () => {
      const hold = createHold();

      expect(() => hold.capture(afterExpiry)).toThrow(InvalidStateError);
      expect(hold.status).toBe(HoldEntity.STATUS.ACTIVE);
    });

    it("expires an active hold once its expiry time is reached", () => {
      const hold = createHold();

      hold.expire(afterExpiry);

      expect(hold.status).toBe(HoldEntity.STATUS.EXPIRED);
      expect(hold.isActive()).toBe(false);
    });

    it("rejects expiring a hold before its expiry time", () => {
      const hold = createHold();

      expect(() => hold.expire(beforeExpiry)).toThrow(
        "Hold has not expired.",
      );
      expect(hold.status).toBe(HoldEntity.STATUS.ACTIVE);
    });

    it("does nothing when expiring a non-active hold", () => {
      const hold = createHold({ status: "RELEASED" });

      expect(() => hold.expire(afterExpiry)).not.toThrow();
      expect(hold.status).toBe(HoldEntity.STATUS.RELEASED);
    });

    it("rejects releasing or capturing a hold that is no longer active", () => {
      const released = createHold({ status: "RELEASED" });
      const captured = createHold({ status: "CAPTURED" });

      expect(() => released.release(beforeExpiry)).toThrow(InvalidStateError);
      expect(() => captured.capture(beforeExpiry)).toThrow(InvalidStateError);
    });
  });

  describe("serialization", () => {
    it("serializes its fields and dates", () => {
      const createdAt = new Date("2026-01-01T10:00:00.000Z");
      const expiresAt = new Date("2026-01-01T11:00:00.000Z");
      const hold = createHold({
        createdAt,
        expiresAt,
        metadata: { source: "test" },
      });

      const json = hold.toJSON();

      expect(json).toMatchObject({
        id: "hold-1",
        accountId: "account-1",
        idempotencyKey: "hold-key-1",
        amount: 5000n,
        currency: "NGN",
        description: "",
        status: HoldEntity.STATUS.ACTIVE,
        metadata: { source: "test" },
      });
      expect(json.createdAt).toEqual(createdAt);
      expect(json.expiresAt).toEqual(expiresAt);
    });

    it("copies the top-level metadata object during construction", () => {
      const metadata = { source: "test" };
      const hold = createHold({ metadata });

      metadata.source = "changed";

      expect(hold.toJSON().metadata.source).toBe("test");
    });
  });
});
