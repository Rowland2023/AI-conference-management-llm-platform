
export class TicketController {
  constructor({ ticketCommandService, ticketQueryService }) {
    if (!ticketCommandService || !ticketQueryService) {
      throw new Error(
        "TicketController requires command and query services."
      );
    }

    this.ticketCommandService = ticketCommandService;
    this.ticketQueryService = ticketQueryService;
  }

  getTracingContext(req) {
    return {
      correlationId:
        req.headers["x-correlation-id"] ??
        req.headers["correlation-id"] ??
        req.correlationId ??
        null,
      idempotencyKey: req.headers["idempotency-key"] ?? null,
      userId: req.user?.id ?? null,
    };
  }

  createTicket = async (req, res, next) => {
    try {
      const context = this.getTracingContext(req);
      const ticket = await this.ticketCommandService.createTicket({
        ...req.body,
        ...context,
      });

      return res.status(201).json({ success: true, data: ticket });
    } catch (error) {
      return next(error);
    }
  };

  getTicketById = async (req, res, next) => {
    try {
      const ticket = await this.ticketQueryService.getById(
        req.params.id,
        this.getTracingContext(req)
      );

      return res.status(200).json({ success: true, data: ticket });
    } catch (error) {
      return next(error);
    }
  };

  listTickets = async (req, res, next) => {
    try {
      const result = await this.ticketQueryService.list({
        ...req.query,
        ...this.getTracingContext(req),
      });

      return res.status(200).json({
        success: true,
        data: result.items,
        pagination: result.pagination,
      });
    } catch (error) {
      return next(error);
    }
  };

  reserveTicket = async (req, res, next) => {
    try {
      const context = this.getTracingContext(req);

      if (!context.userId) {
        const error = new Error("Authenticated user is required.");
        error.status = 401;
        return next(error);
      }

      const ticket = await this.ticketCommandService.reserveTicket({
        ticketId: req.params.id,
        quantity: req.body.quantity,
        userId: context.userId,
        correlationId: context.correlationId,
        idempotencyKey: context.idempotencyKey,
      });

      return res.status(200).json({ success: true, data: ticket });
    } catch (error) {
      return next(error);
    }
  };

  releaseTicket = async (req, res, next) => {
    try {
      const context = this.getTracingContext(req);

      const ticket = await this.ticketCommandService.releaseTicket({
        ticketId: req.params.id,
        quantity: req.body.quantity,
        correlationId: context.correlationId,
        idempotencyKey: context.idempotencyKey,
      });

      return res.status(200).json({ success: true, data: ticket });
    } catch (error) {
      return next(error);
    }
  };

  cancelTicket = async (req, res, next) => {
    try {
      const context = this.getTracingContext(req);

      const ticket = await this.ticketCommandService.cancelTicket({
        ticketId: req.params.id,
        reason: req.body.reason,
        correlationId: context.correlationId,
        userId: context.userId,
        idempotencyKey: context.idempotencyKey,
      });

      return res.status(200).json({ success: true, data: ticket });
    } catch (error) {
      return next(error);
    }
  };
}
