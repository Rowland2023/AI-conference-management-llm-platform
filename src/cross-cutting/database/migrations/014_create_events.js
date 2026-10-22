export async function up(knex) {
    const exists = await knex.schema.hasTable("events");

    if (exists) return;

    await knex.schema.createTable("events", (table) => {
        table.uuid("id").primary();
        table.string("title", 150).notNullable();
        table.uuid("room_id").notNullable();
        table.uuid("organizer_id").notNullable();
        table.timestamp("start_time", { useTz: true }).notNullable();
        table.timestamp("end_time", { useTz: true }).notNullable();
        table.string("status", 30).notNullable().defaultTo("Scheduled");
        table.integer("version").notNullable().defaultTo(0);
        table.timestamp("created_at", { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());
        table.timestamp("updated_at", { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());

        table.index(["room_id", "start_time", "end_time"]);
        table.index(["organizer_id", "start_time"]);
    });
}

export async function down(knex) {
    await knex.schema.dropTableIfExists("events");
}
