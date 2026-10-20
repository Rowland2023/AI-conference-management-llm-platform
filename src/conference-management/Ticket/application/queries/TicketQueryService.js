
export class TicketQueryService {
  constructor({ ticketRepository, logger }) {
    if (!ticketRepository) {
      throw new Error("TicketQueryService requires ticketRepository.");
    }

    this.ticketRepository = ticketRepository;
    this.logger = logger;
  }

  async getById(ticketId, { correlationId } = {}) {
    this.logger?.debug?.(
      { ticketId, correlationId },
      "Getting ticket by id."
    );

    const ticket = await this.ticketRepository.findById(ticketId);

    if (!ticket) {
      const error = new Error(`Ticket ${ticketId} was not found.`);
      error.status = 404;
      error.code = "TICKET_NOT_FOUND";
      throw error;
    }

    return ticket.toJSON();
  }

  async list({
    conferenceId,
    status,
    type,
    page = 1,
    limit = 20,
    correlationId,
  } = {}) {
    this.logger?.debug?.(
      { conferenceId, status, type, page, limit, correlationId },
      "Listing tickets."
    );

    const result = await this.ticketRepository.findAll({
      conferenceId,
      status,
      type,
      page,
      limit,
    });

    return {
      items: result.items.map(ticket => ticket.toJSON()),
      pagination: result.pagination,
    };
  }

  async getAvailability(ticketId, { correlationId } = {}) {
    const availability =
      await this.ticketRepository.findAvailability(ticketId);

    if (!availability) {
      const error = new Error(`Ticket ${ticketId} was not found.`);
      error.status = 404;
      error.code = "TICKET_NOT_FOUND";
      throw error;
    }

    this.logger?.debug?.(
      { ticketId, correlationId, available: availability.available },
      "Ticket availability fetched."
    );

    return availability;
  }

  async exists(ticketId) {
    return this.ticketRepository.exists(ticketId);
  }

  async countByConference(conferenceId) {
    return this.ticketRepository.countByConference(conferenceId);
  }
}
