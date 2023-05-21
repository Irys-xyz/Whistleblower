import { config } from "dotenv";
import { statSync, mkdirSync } from "fs";
import logger from "./logger";

const env = (process.env = { ...config().parsed, ...process.env });

// testing
const IN_TEST_MODE = process.env.JEST_WORKER_ID !== undefined;

// database options
export const DATABASE_DIR = env.DATABASE_DIR ?? "./db";
// regenerate DB dir if it doesn't exist
if (!statSync(DATABASE_DIR, { throwIfNoEntry: false })) {
  logger.warn(`[env] database folder is missing, regenerating.`);
  mkdirSync(DATABASE_DIR, { recursive: true });
}
export const DATABASE_FILE_PATH = env.DATABASE_FILE_PATH ?? DATABASE_DIR + "/db.sqlite";

// logging
export const LOG_LEVEL = IN_TEST_MODE ? "warn" : process.env.LOG_LEVEL ?? "info";
