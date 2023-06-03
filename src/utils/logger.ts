import { createLogger, format, transports } from "winston";
import { LOG_LEVEL } from "./env";

const { combine, timestamp, printf, label } = format;

const myFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});

export const logger = createLogger({
  level: LOG_LEVEL,
  format: combine(timestamp(), label({ label: "WhistleBlower" }), format.cli({}), myFormat),
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
