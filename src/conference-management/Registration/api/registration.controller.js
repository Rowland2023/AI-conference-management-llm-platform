
import { toResponseDto } from "../mappers/RegistrationMapper.js";
import { randomUUID } from "node:crypto";

export class RegistrationController {
  constructor({
    createRegistrationUseCase,
    getRegistrationUseCase,
    getAllRegistrationsUseCase,
    updateRegistrationUseCase,
    cancelRegistrationUseCase,
    checkInRegistrationUseCase,
    logger,
  }) {
    Object.assign(this, {
      createRegistrationUseCase,
      getRegistrationUseCase,
      getAllRegistrationsUseCase,
      updateRegistrationUseCase,
      cancelRegistrationUseCase,
      checkInRegistrationUseCase,
      logger,
    });
  }

  tracingContext(req) {
    return {
      correlationId:
        req.headers["x-correlation-id"] ?? req.id ?? randomUUID(),
      causationId: req.headers["x-request-id"] ?? null,
    };
  }

  createRegistration = async (req, res, next) => {
    try {
      const registration =
        await this.createRegistrationUseCase.execute(
          req.body,
          req.user,
          this.tracingContext(req)
        );

      return res.status(201).json(toResponseDto(registration));
    } catch (error) {
      return next(error);
    }
  };

  getRegistrationById = async (req, res, next) => {
    try {
      const registration =
        await this.getRegistrationUseCase.execute(
          { registrationId: req.params.id },
          req.user
        );

      return res.status(200).json(toResponseDto(registration));
    } catch (error) {
      return next(error);
    }
  };

  getAllRegistrations = async (req, res, next) => {
    try {
      const result =
        await this.getAllRegistrationsUseCase.execute(
          {
            page: req.query.page,
            limit: req.query.limit,
            eventId: req.query.eventId,
            attendeeId: req.query.attendeeId,
            status: req.query.status,
            ticketType: req.query.ticketType,
            sortBy: req.query.sortBy,
            sortOrder: req.query.sortOrder,
          },
          req.user
        );

      return res.status(200).json({
        data: result.items.map(toResponseDto),
        meta: {
          page: result.page,
          limit: result.limit,
          total: result.totalItems,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      return next(error);
    }
  };

  updateRegistration = async (req, res, next) => {
    try {
      const registration =
        await this.updateRegistrationUseCase.execute(
          {
            registrationId: req.params.id,
            data: req.body,
          },
          req.user,
          this.tracingContext(req)
        );

      return res.status(200).json(toResponseDto(registration));
    } catch (error) {
      return next(error);
    }
  };

  checkInRegistration = async (req, res, next) => {
    try {
      const registration =
        await this.checkInRegistrationUseCase.execute(
          { registrationId: req.params.id },
          req.user,
          this.tracingContext(req)
        );

      return res.status(200).json(toResponseDto(registration));
    } catch (error) {
      return next(error);
    }
  };

  cancelRegistration = async (req, res, next) => {
    try {
      await this.cancelRegistrationUseCase.execute(
        {
          registrationId: req.params.id,
          reason: req.body?.reason,
        },
        req.user,
        this.tracingContext(req)
      );

      return res.sendStatus(204);
    } catch (error) {
      return next(error);
    }
  };
}
