
import { InvoiceStatus } from "../../src/conference-management/accounting-services/invoice/domain/value-objects/InvoiceStatus.js";

describe("InvoiceStatus", () => {
    test("normalizes valid status strings", () => {
        expect(new InvoiceStatus(" draft ").value).toBe("DRAFT");
        expect(new InvoiceStatus("paid").value).toBe("PAID");
    });

    test("rejects an unknown status", () => {
        expect(() => new InvoiceStatus("OVERDUE")).toThrow(
            "Invalid invoice status",
        );
        expect(() => new InvoiceStatus("OVERDUE")).toThrow(
            expect.objectContaining({ name: "InvalidInvoiceStatusError" }),
        );
    });

    test("allows valid transitions from DRAFT", () => {
        const draft = InvoiceStatus.DRAFT;

        expect(draft.canTransitionTo("ISSUED")).toBe(true);
        expect(draft.canTransitionTo(InvoiceStatus.CANCELLED)).toBe(true);
        expect(draft.canTransitionTo("PAID")).toBe(false);
    });

    test("allows partial payment and payment completion from ISSUED", () => {
        const issued = InvoiceStatus.ISSUED;

        expect(issued.canTransitionTo("PARTIALLY_PAID")).toBe(true);
        expect(issued.canTransitionTo("PAID")).toBe(true);
        expect(issued.canTransitionTo("DRAFT")).toBe(false);
    });

    test.each(["PAID", "CANCELLED"])(
        "%s is terminal and cannot transition to another status",
        (status) => {
            const invoiceStatus = new InvoiceStatus(status);

            expect(invoiceStatus.isTerminal).toBe(true);
            expect(invoiceStatus.canTransitionTo("DRAFT")).toBe(false);
        },
    );

    test("assertCanTransitionTo throws for a forbidden transition", () => {
        expect(() =>
            InvoiceStatus.PAID.assertCanTransitionTo("ISSUED"),
        ).toThrow(
            expect.objectContaining({
                name: "DomainRuleViolationError",
                statusCode: 400,
            }),
        );
    });

    test("supports equality, conversion, and serialization", () => {
        const paid = new InvoiceStatus("paid");

        expect(paid.equals(InvoiceStatus.PAID)).toBe(true);
        expect(paid.equals("PAID")).toBe(true);
        expect(paid.equals("DRAFT")).toBe(false);
        expect(InvoiceStatus.from(paid)).toBe(paid);
        expect(InvoiceStatus.from("issued").value).toBe("ISSUED");
        expect(paid.toString()).toBe("PAID");
        expect(paid.toJSON()).toBe("PAID");
        expect(JSON.stringify(paid)).toBe('"PAID"');
        expect(Object.isFrozen(paid)).toBe(true);
    });
});
