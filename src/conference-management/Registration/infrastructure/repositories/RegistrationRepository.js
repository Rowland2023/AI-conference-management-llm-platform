
import { Registration } from "../../domain/entities/Registration.js";

export class RegistrationRepository {
  constructor(db) {
    if (typeof db !== "function") {
      throw new TypeError("RegistrationRepository requires a Knex client.");
    }

    this.db = db;
  }

  client(tx) {
    return tx ?? this.db;
  }

  toEntity(row) {
    if (!row) return null;

    return new Registration({
      id: row.id,
      conferenceId: row.conference_id,
      userId: row.user_id,
      ticketTier: row.ticket_tier,
      status: row.status,
      attendeeNotes: row.attendee_notes,
      dietaryRequirements: row.dietary_requirements,
      specialAssistance: row.special_assistance,
      paymentId: row.payment_id,
      checkedInAt: row.checked_in_at,
      cancelledAt: row.cancelled_at,
      version: row.version ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    });
  }

  async findById(id, tx = null) {
    const row = await this.client(tx)("registrations")
      .where({ id })
      .whereNull("deleted_at")
      .first();

    return this.toEntity(row);
  }

  async findByIdForUpdate(id, tx) {
    if (!tx) {
      throw new TypeError(
        "findByIdForUpdate requires an active transaction."
      );
    }

    const row = await tx("registrations")
      .where({ id })
      .whereNull("deleted_at")
      .forUpdate()
      .first();

    return this.toEntity(row);
  }

  async existsByConferenceAndUser(conferenceId, userId, tx = null) {
    const row = await this.client(tx)("registrations")
      .where({
        conference_id: conferenceId,
        user_id: userId,
      })
      .whereNot("status", "CANCELLED")
      .whereNull("deleted_at")
      .first("id");

    return Boolean(row);
  }

  async countActiveRegistrationsByTier(
    conferenceId,
    ticketTier,
    tx = null
  ) {
    const row = await this.client(tx)("registrations")
      .where({
        conference_id: conferenceId,
        ticket_tier: String(ticketTier).toUpperCase(),
      })
      .whereIn("status", [
        "PENDING",
        "CONFIRMED",
        "CHECKED_IN",
      ])
      .whereNull("deleted_at")
      .count({ total: "*" })
      .first();

    return Number(row?.total ?? 0);
  }

  async save(registration, tx = null) {
    const client = this.client(tx);
    const payload = registration.toPersistence();

    const existing = await client("registrations")
      .where({ id: registration.id })
      .first("version");

    if (!existing) {
      await client("registrations").insert(payload);
      return registration;
    }

    const expectedVersion = Number(registration.version ?? 0);

    const affected = await client("registrations")
      .where({
        id: registration.id,
        version: expectedVersion,
      })
      .update({
        ...payload,
        version: expectedVersion + 1,
      });

    if (affected !== 1) {
      const error = new Error(
        "Registration was concurrently modified. Reload and retry."
      );
      error.code = "OPTIMISTIC_CONCURRENCY_CONFLICT";
      throw error;
    }

    registration.incrementVersion();
    return registration;
  }

  async update(registration, tx = null) {
    return this.save(registration, tx);
  }

  async findAll(filters = {}) {
    const {
      page = 1,
      limit = 20,
      conferenceId,
      userId,
      status,
      ticketTier,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = filters;

    const sortColumns = {
      createdAt: "created_at",
      updatedAt: "updated_at",
      status: "status",
    };

    const sortColumn = sortColumns[sortBy] ?? "created_at";
    const direction =
      String(sortOrder).toUpperCase() === "ASC" ? "asc" : "desc";

    const buildQuery = () => {
      const query = this.db("registrations").whereNull("deleted_at");

      if (conferenceId) query.where("conference_id", conferenceId);
      if (userId) query.where("user_id", userId);
      if (status) query.where("status", String(status).toUpperCase());
      if (ticketTier) {
        query.where("ticket_tier", String(ticketTier).toUpperCase());
      }

      return query;
    };

    const countRow = await buildQuery()
      .count({ total: "*" })
      .first();

    const items = await buildQuery()
      .orderBy(sortColumn, direction)
      .limit(Number(limit))
      .offset((Number(page) - 1) * Number(limit));

    return {
      items: items.map(row => this.toEntity(row)),
      totalItems: Number(countRow?.total ?? 0),
    };
  }
}
