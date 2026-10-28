
import RefundReason from "../../src/conference-management/accounting-services/refund/domain/RefundReason.js";
import { InvalidRefundReasonError } from "../../src/conference-management/accounting-services/refund/domain/RefundErrors.js";

describe("RefundReason", () => {
    test("normalizes category and trims notes", () => {
        const reason = new RefundReason({
            category: " customer_request ",
            notes: "  Customer asked for a refund.  ",
        });

        expect(reason.category).toBe("CUSTOMER_REQUEST");
        expect(reason.notes).toBe("Customer asked for a refund.");
        expect(reason.toString()).toBe(
            "CUSTOMER_REQUEST: Customer asked for a refund.",
        );
    });

    test("rejects a missing or blank category", () => {
        expect(() => new RefundReason({ category: "" })).toThrow(
            InvalidRefundReasonError,
        );
        expect(() => new RefundReason({ category: "   " })).toThrow(
            "Category is required",
        );
        expect(() => new RefundReason({})).toThrow(
            InvalidRefundReasonError,
        );
    });

    test("rejects an unsupported category", () => {
        expect(() =>
            new RefundReason({ category: "INVALID_REASON" }),
        ).toThrow(InvalidRefundReasonError);
    });

    test("rejects notes longer than 500 characters", () => {
        expect(() =>
            new RefundReason({
                category: "OTHER",
                notes: "x".repeat(501),
            }),
        ).toThrow("cannot exceed 500 characters");
    });

    test("normalizes empty notes to null and freezes the object", () => {
        const reason = new RefundReason({
            category: "OTHER",
            notes: "   ",
        });

        expect(reason.notes).toBeNull();
        expect(reason.toString()).toBe("OTHER");
        expect(Object.isFrozen(reason)).toBe(true);
    });

    test("reconstitutes a category and notes from a stored string", () => {
        const reason = RefundReason.fromString(
            " duplicate_charge : Duplicate payment ",
        );

        expect(reason.category).toBe("DUPLICATE_CHARGE");
        expect(reason.notes).toBe("Duplicate payment");
    });

    test("preserves colons in notes when parsing a stored string", () => {
        const reason = RefundReason.fromString(
            "OTHER: Reference: TX-123",
        );

        expect(reason.notes).toBe("Reference: TX-123");
        expect(reason.toString()).toBe("OTHER: Reference: TX-123");
    });

    test("falls back to OTHER for unstructured historical values", () => {
        const reason = RefundReason.fromString(
            "Customer changed their mind",
        );

        expect(reason.category).toBe("OTHER");
        expect(reason.notes).toBe("Customer changed their mind");
    });

    test("defaults invalid raw input to OTHER without notes", () => {
        expect(RefundReason.fromString(null).category).toBe("OTHER");
    });

    test("compares value objects and serializes to JSON", () => {
        const first = new RefundReason({
            category: "FRAUDULENT",
            notes: "Unauthorized transaction",
        });
        const equivalent = new RefundReason({
            category: "fraudulent",
            notes: "Unauthorized transaction",
        });
        const different = new RefundReason({
            category: "FRAUDULENT",
            notes: "Different transaction",
        });

        expect(first.equals(equivalent)).toBe(true);
        expect(first.equals(different)).toBe(false);
        expect(first.equals({ category: "FRAUDULENT" })).toBe(false);
        expect(first.toJSON()).toEqual({
            category: "FRAUDULENT",
            notes: "Unauthorized transaction",
            formatted: "FRAUDULENT: Unauthorized transaction",
        });
        expect(JSON.stringify(first)).toContain('"category":"FRAUDULENT"');
    });

    test("exposes the allowed categories", () => {
        expect(RefundReason.ALLOWED_CATEGORIES).toContain("OTHER");
        expect(RefundReason.ALLOWED_CATEGORIES).toContain("DUPLICATE_CHARGE");
        expect(Object.isFrozen(RefundReason.ALLOWED_CATEGORIES)).toBe(true);
    });
});
