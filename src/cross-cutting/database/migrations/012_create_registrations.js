export async function up(knex) {
  await knex.schema.createTable("registrations", (table) => {
    table.uuid("id").primary();

    table
      .uuid("conference_id")
      .notNullable()
      .references("id")
      .inTable("conferences")
      .onDelete("RESTRICT");

    table.uuid("user_id").notNullable();
    table.string("ticket_tier", 32).notNullable();
    table.string("status", 24).notNullable().defaultTo("PENDING");

    table.text("attendee_notes").nullable();
    table.text("dietary_requirements").nullable();
    table.text("special_assistance").nullable();

    table.uuid("payment_id").nullable();
    table.timestamp("checked_in_at", { useTz: true }).nullable();
    table.timestamp("cancelled_at", { useTz: true }).nullable();

    table.integer("version").notNullable().defaultTo(0);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("deleted_at", { useTz: true }).nullable();

    table.index(["conference_id", "ticket_tier", "status"], "registrations_capacity_idx");
    table.index(["conference_id", "user_id"], "registrations_conference_user_idx");
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("registrations");
}
