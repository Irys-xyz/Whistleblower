import { statSync, mkdirSync } from "fs";
import { resolve } from "path";
import { type Config } from "@/types/config";
import { type ApiConfig } from "arweave/node/lib/api";
import { ONE_DAY, ONE_WEEK } from "./constants";

export const IS_TS = !!process[Symbol.for("ts-node.register.instance")];

// TODO: use Zod for validation

const configPath = resolve(process.cwd(), IS_TS ? "config.ts" : "./build/config.js");
const configFileExists = statSync(configPath, { throwIfNoEntry: false });

// eslint-disable-next-line @typescript-eslint/no-var-requires
export const config: Config | undefined = configFileExists ? require(configPath).default : undefined;

export const DEBUG = !!(process.env.debug ?? config?.system?.debug);

// TODO: see how viable using longJohn for extended traces in debug mode is
if (DEBUG) {
  // double stacktrace limit
  Error.stackTraceLimit = 20;
  // potentially dangerous hack to always include stack traces
  Error.prototype.toString = function (): string {
    const name = this.name ?? "Error";
    const msg = (this.message ?? "") + "\n" + this.stack;
    return `${name}: ${msg}`;
  };
}

export const ENABLE_TPS_COUNTER = config?.system?.enableTpsCounter ?? false;
// logging
export const LOG_LEVEL = DEBUG ? "debug" : process.env.LOG_LEVEL ?? config?.system?.logLevel ?? "info";
// database options

export const DATABASE_DIR = config?.database?.dir ?? "./db";

// regenerate DB dir if it doesn't exist
if (!statSync(DATABASE_DIR, { throwIfNoEntry: false })) {
  // console.warn(`[env] database folder is missing, regenerating.`);
  mkdirSync(DATABASE_DIR, { recursive: true });
}

export const DATABASE_FILE_PATH = resolve(DATABASE_DIR, config?.database?.file ?? "db.sqlite");

export const ALERT_FILE_PATH = resolve(
  process.cwd(),
  config?.alert?.filePath ?? IS_TS ? "alert.ts" : "./build/alert.js",
);
if (!statSync(ALERT_FILE_PATH, { throwIfNoEntry: false }))
  throw new Error(`Alert file not found at ${ALERT_FILE_PATH}`);

// eslint-disable-next-line @typescript-eslint/no-var-requires
export const alertFunction = require(ALERT_FILE_PATH).default;

export const GATEWAY_URL = config?.arweave?.gatewayUrl ?? new URL(`http://arweave.net`);
export const GATEWAY_CONFIG: ApiConfig = {
  host: GATEWAY_URL?.host,
  port: GATEWAY_URL?.port,
  protocol: GATEWAY_URL?.protocol.replaceAll(":", ""),
};

export const TX_DEADLINE_OFFSET = config?.system?.txDeadlineOffset ?? 1000;
export const MAX_PEER_DEPTH = config?.system?.maxPeerDepth ?? 2;
export const START_HEIGHT = config?.arweave?.startHeight;
export const MAX_TX_AGE = config?.system?.maxTxAgeMs ?? ONE_DAY;
export const MAX_BUNDLE_AGE = config?.system?.maxBundleAgeMs ?? ONE_WEEK;
export const ORPHAN_AGE_THRESHOLD = config?.system?.orphanTxAgeThresholdMs ?? 20 * 2 * 60 * 1000; // 20 blocks (ish)
export const ORPHAN_RESOLVE_CONCURRENCY =
  (config?.system?.orphanResolveConcurrency ?? 10) < 1 ? 10 : config?.system?.orphanResolveConcurrency ?? 10;
export const PRESERVE_INVALID = config?.system?.preserveInvalid ?? false;
export const BUNDLE_VERIFY_CONCURRENCY =
  (config?.system?.bundleVerifyConcurrency ?? 10) < 1 ? 10 : config?.system?.bundleVerifyConcurrency ?? 10;

export const DEFAULT_AXIOS_CONFIG = config?.request?.defaultAxiosConfig ?? { timeout: 20_000 };
export const DEFAULT_REQUEST_RETRY_CONFIG = config?.request?.defaultRetryConfig ?? {};
