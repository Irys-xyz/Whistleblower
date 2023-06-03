import { Knex } from "knex";
import Config = Knex.Config;
import { DATABASE_FILE_PATH } from "./src/utils/env";

export default {
  client: "better-sqlite3",
  connection: {
    filename: DATABASE_FILE_PATH,
  },
  useNullAsDefault: true,
  migrations: {
    tableName: "migrations",
    loadExtensions: [".ts"],
    extension: "ts",
    directory: "./migrations",
    disableTransactions: true, // without this pragma and vacuum don't work :/
  },
  onUpdateTrigger: (table) => `
    CREATE TRIGGER ${table}_updated_at
    BEFORE UPDATE ON ${table}
    FOR EACH ROW
    EXECUTE PROCEDURE on_update_timestamp();
  `,
} as Config;
