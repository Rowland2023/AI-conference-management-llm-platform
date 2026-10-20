
import Joi from "joi";

const uuid = Joi.string().uuid();

const quantity = Joi.number()
  .integer()
  .positive()
  .max(10000)
  .required();

export const createTicketSchema = Joi.object({
  conferenceId: uuid.required(),
  type: Joi.string().trim().min(1).max(100).required(),
  price: Joi.number().min(0).required(),
  currency: Joi.string()
    .trim()
    .length(3)
    .uppercase()
    .required(),
  capacity: Joi.number()
    .integer()
    .positive()
    .max(10000000)
    .required(),
}).required();

export const ticketIdSchema = Joi.object({
  id: uuid.required(),
}).required();

export const ticketQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  conferenceId: uuid.optional(),
  type: Joi.string().trim().max(100).optional(),
  status: Joi.string()
    .valid("ACTIVE", "CANCELLED")
    .optional(),
}).required();

export const reserveTicketSchema = Joi.object({
  quantity,
}).required();

export const releaseTicketSchema = Joi.object({
  quantity,
}).required();

export const cancelTicketSchema = Joi.object({
  reason: Joi.string().trim().min(1).max(500).required(),
}).required();
