export async function up(knex) {
  await knex.schema.createTable("conferences", (table) => {
    table.uuid("id").primary();
    table.string("title", 255).notNullable();
    table.text("description").nullable();
    table.timestamp("start_date", { useTz: true }).nullable();
    table.timestamp("end_date", { useTz: true }).nullable();

    table.uuid("organizer_id").nullable();
    table.boolean("registration_open").notNullable().defaultTo(true);
    table.jsonb("ticket_tier_capacities").notNullable().defaultTo("{}");

    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("conferences");
}
