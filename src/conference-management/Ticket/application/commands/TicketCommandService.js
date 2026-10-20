
import { Ticket } from "../../domain/entities/Ticket.js";
import { Money } from "../../domain/valueobjects/Money.js";

export class TicketCommandService {
  constructor({
    ticketRepository,
    outboxRepository,
    unitOfWork,
    logger,
  }) {
    if (!ticketRepository || !outboxRepository || !unitOfWork) {
      throw new Error("TicketCommandService dependencies are required.");
    }

    Object.assign(this, {
      ticketRepository,
      outboxRepository,
      unitOfWork,
      logger,
    });
  }

  async #persistEvents(ticket, transaction) {
    const events = ticket.pullEvents();

    if (events.length > 0) {
      await this.outboxRepository.save(events, transaction);
    }
  }

  async createTicket(input) {
    return this.unitOfWork.runInTransaction(async transaction => {
      const ticket = Ticket.create({
        conferenceId: input.conferenceId,
        type: input.type,
        price: new Money(input.price, input.currency),
        capacity: input.capacity,
        correlationId: input.correlationId,
      });

      await this.ticketRepository.save(ticket, transaction);
      await this.#persistEvents(ticket, transaction);

      this.logger?.info?.(
        { ticketId: ticket.id, conferenceId: ticket.conferenceId },
        "Ticket inventory created."
      );

      return ticket.toJSON();
    });
  }

  async reserveTicket(input) {
    return this.unitOfWork.runInTransaction(async transaction => {
      const ticket = await this.#loadForUpdate(input.ticketId, transaction);

      ticket.reserve(
        input.quantity,
        input.userId,
        input.correlationId
      );

      await this.ticketRepository.save(ticket, transaction);
      await this.#persistEvents(ticket, transaction);

      return ticket.toJSON();
    });
  }

  async releaseTicket(input) {
    return this.unitOfWork.runInTransaction(async transaction => {
      const ticket = await this.#loadForUpdate(input.ticketId, transaction);

      ticket.release(input.quantity, input.correlationId);

      await this.ticketRepository.save(ticket, transaction);
      await this.#persistEvents(ticket, transaction);

      return ticket.toJSON();
    });
  }

  async confirmPurchase(input) {
    return this.unitOfWork.runInTransaction(async transaction => {
      const ticket = await this.#loadForUpdate(input.ticketId, transaction);

      ticket.confirmPurchase(
        input.quantity,
        input.paymentId,
        input.correlationId
      );

      await this.ticketRepository.save(ticket, transaction);
      await this.#persistEvents(ticket, transaction);

      return ticket.toJSON();
    });
  }

  async cancelTicket(input) {
    return this.unitOfWork.runInTransaction(async transaction => {
      const ticket = await this.#loadForUpdate(input.ticketId, transaction);

      ticket.cancel(input.reason, input.correlationId);

      await this.ticketRepository.save(ticket, transaction);
      await this.#persistEvents(ticket, transaction);

      return ticket.toJSON();
    });
  }

  
async cancelTicketsByConference({ conferenceId, reason, correlationId }) {
  if (!conferenceId) {
    throw new Error("conferenceId is required.");
  }

  return this.unitOfWork.runInTransaction(async transaction => {
    const tickets =
      await this.ticketRepository.findActiveByConferenceForUpdate(
        conferenceId,
        transaction
      );

    let cancelledCount = 0;

    for (const ticket of tickets) {
      ticket.cancel(
        reason || "CONFERENCE_CANCELLED",
        correlationId
      );

      await this.ticketRepository.save(ticket, transaction);
      await this.#persistEvents(ticket, transaction);
      cancelledCount += 1;
    }

    this.logger?.info?.(
      { conferenceId, cancelledCount, correlationId },
      "Ticket inventory cancelled for conference."
    );

    return { cancelledCount };
  });
}

  async #loadForUpdate(ticketId, transaction) {
    if (!ticketId) {
      throw new Error("ticketId is required.");
    }

    const ticket = await this.ticketRepository.findByIdForUpdate(
      ticketId,
      transaction
    );

    if (!ticket) {
      const error = new Error(`Ticket ${ticketId} was not found.`);
      error.status = 404;
      error.code = "TICKET_NOT_FOUND";
      throw error;
    }

    return ticket;
  }
}
