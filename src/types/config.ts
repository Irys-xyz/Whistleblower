import { type ApiConfig } from "arweave/node/lib/api";

export type Config = {
  database?: {
    dir?: string;
    file?: string;
  };
  arweave?: {
    gateway?: ApiConfig;
    basePeers?: UrlString[];
    startHeight?: number;
  };
  bundlers?: Record<
    UrlString,
    {
      checkExpression?: string;
    }
  >;
  system?: {
    logLevel?: "debug" | "verbose" | "info" | "warn" | "error";
    validatedKeepDays?: number;
    txDeadlineOffset?: number;
    maxPeerDepth?: number;
    debug?: boolean;
    maxTxAgeMs?: number;
    maxBundleAgeMs?: number;
    enableTpsCounter?: boolean;
    orphanTxAgeThresholdMs?: number;
    preserveInvalid?: boolean;
    bundleVerifyConcurrency?: number;
  };

  alert?: {
    filePath?: string;
    // custom options
    [k: string]: any;
  };
};

export type UrlString = `${"http" | "https"}://${string}`;
export type WsString = `${"ws" | "wss"}://${string}`;
// export type NonNegativeInteger<T extends number> = number extends T ? never : `${T}` extends `-${string}` | `${string}.${string}` ? never : T;
