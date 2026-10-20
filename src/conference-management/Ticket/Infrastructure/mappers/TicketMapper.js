
import { Ticket } from "../../domain/entities/Ticket.js";
import { Money } from "../../domain/valueobjects/Money.js";

export class TicketMapper {
  toDomain(row) {
    if (!row) return null;

    return Ticket.rehydrate({
      id: row.id,
      conferenceId: row.conference_id ?? row.conferenceId,
      type: row.type,
      price: new Money(
        row.price_amount ?? row.priceAmount,
        row.price_currency ?? row.priceCurrency
      ),
      capacity: Number(row.capacity),
      reserved: Number(row.reserved),
      sold: Number(row.sold),
      status: row.status,
      version: Number(row.version ?? 0),
    });
  }

  toPersistence(ticket) {
    return {
      id: ticket.id,
      conference_id: ticket.conferenceId,
      type: ticket.type,
      price_amount: ticket.price.amount,
      price_currency: ticket.price.currency,
      capacity: ticket.capacity,
      reserved: ticket.reserved,
      sold: ticket.sold,
      status: ticket.status,
      version: ticket.version,
    };
  }

  toDTO(ticket) {
    return ticket?.toJSON?.() ?? null;
  }
}
