
export async function up(knex) {
  await knex.schema.createTable("tickets", (table) => {
    table.uuid("id").primary();

    table
      .uuid("conference_id")
      .notNullable()
      .references("id")
      .inTable("conferences")
      .onDelete("RESTRICT");

    table.string("type", 100).notNullable();

    // Store the numeric amount as supplied by the Money value object.
    table.decimal("price_amount").notNullable();
    table.string("price_currency", 3).notNullable();

    table.integer("capacity").notNullable();
    table.integer("reserved").notNullable().defaultTo(0);
    table.integer("sold").notNullable().defaultTo(0);

    table.string("status", 24).notNullable().defaultTo("ACTIVE");
    table.integer("version").notNullable().defaultTo(0);

    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table
      .timestamp("updated_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table.index(
      ["conference_id", "status"],
      "tickets_conference_status_idx"
    );

    table.index(
      ["conference_id", "type"],
      "tickets_conference_type_idx"
    );
  });

  await knex.raw(`
    ALTER TABLE tickets
      ADD CONSTRAINT tickets_capacity_positive
        CHECK (capacity > 0),
      ADD CONSTRAINT tickets_reserved_nonnegative
        CHECK (reserved >= 0),
      ADD CONSTRAINT tickets_sold_nonnegative
        CHECK (sold >= 0),
      ADD CONSTRAINT tickets_inventory_within_capacity
        CHECK (reserved + sold <= capacity),
      ADD CONSTRAINT tickets_price_nonnegative
        CHECK (price_amount >= 0),
      ADD CONSTRAINT tickets_currency_format
        CHECK (price_currency ~ '^[A-Z]{3}$'),
      ADD CONSTRAINT tickets_status_valid
        CHECK (status IN ('ACTIVE', 'CANCELLED')),
      ADD CONSTRAINT tickets_version_nonnegative
        CHECK (version >= 0)
  `);
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("tickets");
}
