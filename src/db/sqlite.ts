import knex from "knex";
import { DATABASE_FILE_PATH } from "@/utils/env";

export const database = knex({
  client: "better-sqlite3",
  connection: {
    filename: DATABASE_FILE_PATH,
    pool: {
      min: 1,
      max: 20,
    },
  },
  useNullAsDefault: true,
});

export default database;
