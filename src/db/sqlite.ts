import knex from "knex";
import { DATABASE_FILE_PATH } from "@/utils/env";
import { wrapKnex } from "./wrapper";

export const database = knex({
  client: "better-sqlite3",
  connection: {
    filename: DATABASE_FILE_PATH,
    pool: {
      min: 1,
      max: 20,
    },
    // @ts-expect-error add timeout to prevent sqlite busy errors
    timeout: 20_000,
  },
  useNullAsDefault: true,
});
wrapKnex(database);

export default database;
