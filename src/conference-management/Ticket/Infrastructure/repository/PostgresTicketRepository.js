
export class PostgresTicketRepository {
  constructor({ db, mapper }) {
    if (typeof db !== "function") {
      throw new Error("PostgresTicketRepository requires a Knex database.");
    }

    if (!mapper) {
      throw new Error("PostgresTicketRepository requires a mapper.");
    }

    this.db = db;
    this.mapper = mapper;
  }

  query(transaction) {
    const query = this.db("tickets");
    return transaction ? query.transacting(transaction) : query;
  }

  async findById(id, transaction) {
    const row = await this.query(transaction)
      .where({ id })
      .first();

    return this.mapper.toDomain(row);
  }

  async findByIdForUpdate(id, transaction) {
    if (!transaction) {
      throw new Error("findByIdForUpdate requires a transaction.");
    }

    const row = await this.query(transaction)
      .where({ id })
      .forUpdate()
      .first();

    return this.mapper.toDomain(row);
  }

  async save(ticket, transaction) {
    if (!transaction) {
      throw new Error("Ticket writes require a transaction.");
    }

    const payload = this.mapper.toPersistence(ticket);

    if (ticket.version === 0) {
      const existing = await this.query(transaction)
        .where({ id: ticket.id })
        .first();

      if (existing) {
        throw new Error(`Ticket ${ticket.id} already exists.`);
      }

      await this.query(transaction).insert({
        ...payload,
        created_at: this.db.fn.now(),
        updated_at: this.db.fn.now(),
      });

      return ticket;
    }

    // The aggregate increments its version on each successful mutation.
    // Match the previous persisted version to detect concurrent writes.
    const previousVersion = ticket.version - 1;

    const updated = await this.query(transaction)
      .where({
        id: ticket.id,
        version: previousVersion,
      })
      .update({
        type: payload.type,
        price_amount: payload.price_amount,
        price_currency: payload.price_currency,
        capacity: payload.capacity,
        reserved: payload.reserved,
        sold: payload.sold,
        status: payload.status,
        version: ticket.version,
        updated_at: this.db.fn.now(),
      });

    if (updated !== 1) {
      throw new Error(
        `Ticket ${ticket.id} was modified concurrently or no longer exists.`
      );
    }

    return ticket;
  }

  async findAll({
    conferenceId,
    status,
    type,
    page = 1,
    limit = 20,
  } = {}, transaction) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;

    const applyFilters = query => {
      if (conferenceId) query.where("conference_id", conferenceId);
      if (status) query.where("status", status);
      if (type) query.where("type", type);
      return query;
    };

    const countRow = await applyFilters(
      this.query(transaction).clone()
    ).count({ count: "*" }).first();

    const rows = await applyFilters(this.query(transaction).clone())
      .orderBy("id", "asc")
      .limit(safeLimit)
      .offset(offset);

    const total = Number(countRow?.count ?? 0);

    return {
      items: rows.map(row => this.mapper.toDomain(row)),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async findAvailability(id, transaction) {
    const row = await this.query(transaction)
      .select("id", "capacity", "reserved", "sold", "status")
      .where({ id })
      .first();

    if (!row) return null;

    const capacity = Number(row.capacity);
    const reserved = Number(row.reserved);
    const sold = Number(row.sold);

    return {
      ticketId: row.id,
      capacity,
      reserved,
      sold,
      available:
        row.status === "ACTIVE"
          ? capacity - reserved - sold
          : 0,
      status: row.status,
    };
  }

  async exists(id, transaction) {
    const row = await this.query(transaction)
      .select("id")
      .where({ id })
      .first();

    return Boolean(row);
  }

  
async findActiveByConferenceForUpdate(conferenceId, transaction) {
  if (!transaction) {
    throw new Error(
      "findActiveByConferenceForUpdate requires a transaction."
    );
  }

  const rows = await this.query(transaction)
    .where({
      conference_id: conferenceId,
      status: "ACTIVE",
    })
    .orderBy("id", "asc")
    .forUpdate();

  return rows.map(row => this.mapper.toDomain(row));
}

  async countByConference(conferenceId, transaction) {
    const row = await this.query(transaction)
      .where({ conference_id: conferenceId })
      .count({ count: "*" })
      .first();

    return Number(row?.count ?? 0);
  }
}
