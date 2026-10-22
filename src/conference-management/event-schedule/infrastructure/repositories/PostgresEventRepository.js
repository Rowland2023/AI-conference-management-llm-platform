/**
 * Knex repository for the event-schedule bounded context.
 */

export class PostgresEventRepository {
    constructor({ db }) {
        if (!db || typeof db !== "function") {
            throw new TypeError(
                "PostgresEventRepository requires a Knex instance."
            );
        }

        this.db = db;
        this.table = "events";
    }

    toReadModel(row) {
        if (!row) return null;

        return {
            id: row.id,
            title: row.title,
            roomId: row.room_id,
            organizerId: row.organizer_id,
            startTime: row.start_time instanceof Date
                ? row.start_time.toISOString()
                : row.start_time,
            endTime: row.end_time instanceof Date
                ? row.end_time.toISOString()
                : row.end_time,
            status: row.status,
            version: Number(row.version ?? 0),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    async findById(id, trx = this.db) {
        const row = await trx(this.table)
            .where({ id })
            .first();

        return this.toReadModel(row);
    }

    async findAll(filters = {}, trx = this.db) {
        const page = Math.max(1, Number(filters.page) || 1);
        const limit = Math.min(
            100,
            Math.max(1, Number(filters.limit) || 20)
        );

        let query = trx(this.table).select("*");

        if (filters.roomId) {
            query = query.where("room_id", filters.roomId);
        }

        if (filters.organizerId) {
            query = query.where("organizer_id", filters.organizerId);
        }

        if (filters.status) {
            query = query.where("status", filters.status);
        }

        const rows = await query
            .orderBy("start_time", "asc")
            .limit(limit)
            .offset((page - 1) * limit);

        return rows.map((row) => this.toReadModel(row));
    }
}
