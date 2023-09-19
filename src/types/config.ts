import { type retryRequest } from "@utils/axios";
import { type Options } from "async-retry";
export type Config = {
  database?: {
    /**
     * the directory to store the database file (`database.file`), WAL and SHM
     * @default "./db"
     */
    dir?: string;
    /**
     * the name of the database file, stored in `database.dir`
     * @default "db.sqlite"
     */
    file?: string;
  };
  arweave?: {
    /**
     * The Arweave gateway to use
     * @default http://arweave.net
     */
    gatewayUrl?: URL;
    /** a list of peers (arweave miners) to use */
    basePeers?: UrlString[];
    /** The network height WB should start verifying from */
    startHeight?: number;
  };

  request?: {
    defaultAxiosConfig?: Parameters<typeof retryRequest>[1];
    defaultRetryConfig?: Options;
    defaultDownloadTxConcurrency?: number;
  };
  // bundlers?: Record<
  //   UrlString,
  //   {
  //     checkExpression?: string;
  //   }
  // >;
  system?: {
    /**
     * Logging level - debug logs everything, error only logs errors
     * @default "if system.debug is true, debug, else info"
     */
    logLevel?: "debug" | "verbose" | "info" | "warn" | "error";
    /** Modifier to apply to transaction deadline offset, +ve gives more time, -ve gives less. do not use unless you know what you're doing */
    txDeadlineOffset?: number;
    /**
     * Maximum peer discovery depth from the gateway
     * @default 2
     */
    maxPeerDepth?: number;
    /**
     * whether to enable debug mode
     * @default false
     */
    debug?: boolean;
    /**
     * Number of ms to keep valid txs in DB
     * @default 7 * 24 * 60 * 60 * 1000 (one week)
     */
    maxTxAgeMs?: number;
    /**
     * Number of ms to keep valid bundles in DB
     * @default 7 * 24 * 60 * 60 * 1000 (one week)
     */
    maxBundleAgeMs?: number;
    /**
     * Enable a TPS counter for all tracked nodes
     * @default false
     */
    enableTpsCounter?: boolean;
    /**
     * How many ms before expiry is a tx considered an orphan.
     * Do not use unless you know what you're doing
     * @default 20 * 2 * 60 * 1000 (20 blocks)
     */
    orphanTxAgeThresholdMs?: number;
    /**
     * Whether to indefinitely retain invalid txs & bundles in the DB.
     * @default true
     */
    preserveInvalid?: boolean;
    /**
     * Number of concurrent validation jobs to perform.
     * Increasing this increases the maximum CPU, network, and memory usage of WB
     * @default 10
     */
    bundleVerifyConcurrency?: number;

    /**
     * Number of tasks to run per thread, by default the max number
     * of threads is set to bundleVerifyConcurrency, so this value will multiply the throughput
     */
    bundleVerifyTasksPerThread?: number;

    /**
     * Number of concurrent orphan transactions to resolve
     * Increasing this might lead to arweave gateway rate limiting
     * @default 5
     */
    orphanResolveConcurrency?: number;
  };

  alert?: {
    /**
     * Path to the file to import for the alert function
     * note: WB expects the alert function to be the default export
     * @default ./build/alert.js
     */
    filePath?: string;
    // custom options
    [k: string]: any;
  };

  custom?: Record<string, any>;
};

export type UrlString = `${"http" | "https"}://${string}`;
export type WsString = `${"ws" | "wss"}://${string}`;
// export type NonNegativeInteger<T extends number> = number extends T ? never : `${T}` extends `-${string}` | `${string}.${string}` ? never : T;
