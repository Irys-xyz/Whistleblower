import { type Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw("VACUUM;");
  // enable WAL and auto vacuum - must be done before tables are created
  await knex.raw(`PRAGMA journal_mode=WAL;`);
  await knex.raw(`PRAGMA auto_vacuum=FULL;`);

  await knex.schema
    .createTable("transactions", (table) => {
      table.string("tx_id").primary().unique();
      table.boolean("is_valid").defaultTo(false); // if the tx is "valid" - deadline & cryptographically
      table.string("bundled_in").references("tx_id").inTable("bundles");
      table.timestamp("date_verified"); // time this node decided on tx validity
      table.bigInteger("deadline_height"); // maximum network height for inclusion - actual inclusion height via bundles relation
      table.timestamp("date_created").notNullable();
    })
    .createTable("bundles", (table) => {
      table.string("tx_id").primary().unique();
      table.bigInteger("block").notNullable(); // height of the block the bundle is included in
      table.boolean("is_valid");
      table.timestamp("date_verified"); // time this node decided on bundle validity
      table.boolean("nested"); // if this is a nested bundle (not really needed for now?)
      table.timestamp("date_created").notNullable();
      table.string("from_node").references("url").inTable("bundlers").onUpdate("cascade"); // url of the bundler node this bundle came from
    })
    .createTable("peers", (table) => {
      table.string("url").primary().unique(); // full URL (new URL(...).toString())
      table.specificType("trust", "double precision").notNullable();
      table.timestamp("date_created").notNullable();
      table.timestamp("last_praised");
    })
    .createTable("bundlers", (table) => {
      table.string("url").primary().unique();
      table.string("address").notNullable();
    });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .dropTableIfExists("transactions")
    .dropTableIfExists("bundles")
    .dropTableIfExists("peers")
    .dropTableIfExists("bundlers");

  await knex.raw("VACUUM;");
}
