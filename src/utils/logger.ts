import { config } from "dotenv";
import { createLogger, format, transports } from "winston";

const { combine, timestamp, printf, label } = format;

process.env = { ...config().parsed, ...process.env };
const IN_TEST_MODE = process.env.JEST_WORKER_ID !== undefined;
const LOG_LEVEL = IN_TEST_MODE ? "warn" : process.env.LOG_LEVEL ?? "info";

const myFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});

export const logger = createLogger({
  level: LOG_LEVEL,
  format: combine(timestamp(), label({ label: "Bundler Node" }), format.cli({}), myFormat),
  transports: [
    new transports.Console(),
    // new transports.File({
    //   filename: "error.log",
    //   level: "error",
    //   options: { json: true },
    // }),
  ],
});

logger.info.bind(logger);
logger.verbose.bind(logger);
logger.error.bind(logger);
logger.debug.bind(logger);
logger.warning = logger.warn.bind(logger);
// @ts-expect-error injected method
logger.critical = logger.error;

export default logger;
