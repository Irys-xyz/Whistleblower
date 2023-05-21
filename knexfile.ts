import { Knex } from "knex";
import Config = Knex.Config;
import { DATABASE_FILE_PATH } from "./src/utils/env";

export default {
  client: "better-sqlite3",
  connection: {
    filename: DATABASE_FILE_PATH,
  },
  migrations: {
    tableName: "migrations",
    loadExtensions: [".ts"],
    extension: "ts",
    directory: "./migrations",
  },
  onUpdateTrigger: (table) => `
    CREATE TRIGGER ${table}_updated_at
    BEFORE UPDATE ON ${table}
    FOR EACH ROW
    EXECUTE PROCEDURE on_update_timestamp();
  `,
} as Config;
