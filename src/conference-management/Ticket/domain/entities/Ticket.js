
// src/conference-management/ticket/domain/entities/Ticket.js

import { randomUUID } from "node:crypto";

import { Money } from "../valueobjects/Money.js";

import { TicketCreated } from "../events/TicketCreated.js";
import { TicketReserved } from "../events/TicketReserved.js";
import { TicketReleased } from "../events/TicketReleased.js";
import { TicketPurchased } from "../events/TicketPurchased.js";
import { TicketCancelled } from "../events/TicketCancelled.js";

export const TICKET_STATUS = Object.freeze({
    ACTIVE: "ACTIVE",
    CANCELLED: "CANCELLED",
});

const RESERVATION_TTL_MS = 15 * 60 * 1000;

export class Ticket {
    #id;
    #conferenceId;
    #type;
    #price;
    #capacity;
    #reserved;
    #sold;
    #status;
    #version;
    #domainEvents = [];

    constructor({
        id,
        conferenceId,
        type,
        price,
        capacity,
        reserved = 0,
        sold = 0,
        status = TICKET_STATUS.ACTIVE,
        version = 0,
    }) {
        if (typeof id !== "string" || !id.trim()) {
            throw new Error("Ticket id is required.");
        }

        if (
            typeof conferenceId !== "string" ||
            !conferenceId.trim()
        ) {
            throw new Error("Conference id is required.");
        }

        if (typeof type !== "string" || !type.trim()) {
            throw new Error("Ticket type is required.");
        }

        if (!(price instanceof Money)) {
            throw new Error(
                "Ticket price must be a Money instance."
            );
        }

        this.#assertInteger(capacity, "capacity", 1);
        this.#assertInteger(reserved, "reserved", 0);
        this.#assertInteger(sold, "sold", 0);
        this.#assertInteger(version, "version", 0);

        if (!Object.values(TICKET_STATUS).includes(status)) {
            throw new Error(`Invalid ticket status: ${status}`);
        }

        if (reserved + sold > capacity) {
            throw new Error(
                "Reserved and sold quantities cannot exceed capacity."
            );
        }

        this.#id = id;
        this.#conferenceId = conferenceId;
        this.#type = type.trim();
        this.#price = price;
        this.#capacity = capacity;
        this.#reserved = reserved;
        this.#sold = sold;
        this.#status = status;
        this.#version = version;
    }

    // --------------------------------------------------
    // Factory
    // --------------------------------------------------

    static create({
        id = randomUUID(),
        conferenceId,
        type,
        price,
        capacity,
        correlationId = null,
    }) {
        const ticket = new Ticket({
            id,
            conferenceId,
            type,
            price,
            capacity,
        });

        ticket.#addEvent(
            new TicketCreated({
                ticketId: ticket.#id,
                conferenceId: ticket.#conferenceId,
                type: ticket.#type,
                capacity: ticket.#capacity,
                price: ticket.#price.amount,
                currency: ticket.#price.currency,
                correlationId,
            })
        );

        return ticket;
    }

    /**
     * Reconstructs persisted state without emitting domain events.
     */
    static rehydrate(state) {
        return new Ticket(state);
    }

    // --------------------------------------------------
    // Inventory operations
    // --------------------------------------------------

    reserve(quantity, userId, correlationId = null) {
        this.#assertActive();
        this.#assertInteger(quantity, "quantity", 1);

        if (
            typeof userId !== "string" ||
            !userId.trim()
        ) {
            throw new Error(
                "User id is required to reserve tickets."
            );
        }

        const availableBefore = this.available;

        if (quantity > availableBefore) {
            throw new Error(
                `Insufficient ticket inventory. Available: ${availableBefore}.`
            );
        }

        // Keep this as a Date: TicketReserved serializes it.
        const expiresAt = new Date(
            Date.now() + RESERVATION_TTL_MS
        );

        this.#reserved += quantity;
        this.#incrementVersion();

        const availableAfter = this.available;

        this.#addEvent(
            new TicketReserved({
                ticketId: this.#id,
                conferenceId: this.#conferenceId,
                quantity,
                userId: userId.trim(),
                availableAfter,
                expiresAt,
                correlationId,
            })
        );

        return {
            ticketId: this.#id,
            quantity,
            expiresAt: expiresAt.toISOString(),
            available: availableAfter,
        };
    }

    release(quantity, correlationId = null) {
        this.#assertInteger(quantity, "quantity", 1);

        if (quantity > this.#reserved) {
            throw new Error(
                `Cannot release ${quantity} tickets; only ${this.#reserved} are reserved.`
            );
        }

        this.#reserved -= quantity;
        this.#incrementVersion();

        this.#addEvent(
            new TicketReleased({
                ticketId: this.#id,
                conferenceId: this.#conferenceId,
                quantity,
                correlationId,
            })
        );

        return {
            ticketId: this.#id,
            released: quantity,
            available: this.available,
        };
    }

    confirmPurchase(
        quantity,
        paymentId,
        correlationId = null
    ) {
        this.#assertActive();
        this.#assertInteger(quantity, "quantity", 1);

        if (
            typeof paymentId !== "string" ||
            !paymentId.trim()
        ) {
            throw new Error("Payment id is required.");
        }

        if (quantity > this.#reserved) {
            throw new Error(
                `Cannot confirm purchase of ${quantity} tickets; only ${this.#reserved} are reserved.`
            );
        }

        this.#reserved -= quantity;
        this.#sold += quantity;
        this.#incrementVersion();

        this.#addEvent(
            new TicketPurchased({
                ticketId: this.#id,
                conferenceId: this.#conferenceId,
                quantity,
                paymentId: paymentId.trim(),
                soldTotal: this.#sold,
                revenue: this.#price.amount * quantity,
                currency: this.#price.currency,
                correlationId,
            })
        );

        return {
            ticketId: this.#id,
            purchased: quantity,
            sold: this.#sold,
            reserved: this.#reserved,
            available: this.available,
        };
    }

    cancel(reason, correlationId = null) {
        if (this.#status === TICKET_STATUS.CANCELLED) {
            throw new Error(
                "Ticket inventory is already cancelled."
            );
        }

        if (typeof reason !== "string" || !reason.trim()) {
            throw new Error("Cancellation reason is required.");
        }

        const eventData = {
            ticketId: this.#id,
            conferenceId: this.#conferenceId,
            reason: reason.trim(),
            refundableCount: this.#sold,
            reservedToRelease: this.#reserved,
            correlationId,
        };

        this.#reserved = 0;
        this.#status = TICKET_STATUS.CANCELLED;
        this.#incrementVersion();

        this.#addEvent(new TicketCancelled(eventData));

        return {
            ticketId: this.#id,
            status: this.#status,
            refundableCount: eventData.refundableCount,
            releasedReservations: eventData.reservedToRelease,
        };
    }

    // --------------------------------------------------
    // Domain event handling
    // --------------------------------------------------

    #addEvent(event) {
        this.#domainEvents.push(event);
    }

    /**
     * Returns and clears pending events.
     * The caller must persist these events to the outbox
     * within the same database transaction as the aggregate.
     */
    pullEvents() {
        const events = this.#domainEvents;
        this.#domainEvents = [];
        return events;
    }

    // --------------------------------------------------
    // Internal invariants
    // --------------------------------------------------

    #assertActive() {
        if (this.#status !== TICKET_STATUS.ACTIVE) {
            throw new Error(
                "Operation is not permitted on cancelled ticket inventory."
            );
        }
    }

    #assertInteger(value, field, minimum) {
        if (
            !Number.isSafeInteger(value) ||
            value < minimum
        ) {
            throw new Error(
                `${field} must be an integer greater than or equal to ${minimum}.`
            );
        }
    }

    #incrementVersion() {
        if (this.#version >= Number.MAX_SAFE_INTEGER) {
            throw new Error("Ticket version has reached its maximum value.");
        }

        this.#version += 1;
    }

    // --------------------------------------------------
    // Read-only accessors
    // --------------------------------------------------

    get id() {
        return this.#id;
    }

    get conferenceId() {
        return this.#conferenceId;
    }

    get type() {
        return this.#type;
    }

    get price() {
        return this.#price;
    }

    get capacity() {
        return this.#capacity;
    }

    get reserved() {
        return this.#reserved;
    }

    get sold() {
        return this.#sold;
    }

    get status() {
        return this.#status;
    }

    get version() {
        return this.#version;
    }

    get available() {
        if (this.#status !== TICKET_STATUS.ACTIVE) {
            return 0;
        }

        return this.#capacity - this.#reserved - this.#sold;
    }

    // --------------------------------------------------
    // Serialization
    // --------------------------------------------------

    toJSON() {
        return {
            id: this.#id,
            conferenceId: this.#conferenceId,
            type: this.#type,
            price: this.#price.toJSON(),
            capacity: this.#capacity,
            reserved: this.#reserved,
            sold: this.#sold,
            available: this.available,
            status: this.#status,
            version: this.#version,
        };
    }
}
