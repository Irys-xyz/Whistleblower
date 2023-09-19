import logger from "@logger";
import { BUNDLE_VERIFY_CONCURRENCY } from "@utils/env";
import path from "path";
import Piscina from "piscina";

export const bundleVerifier = new Piscina({
  filename: path.resolve(process.cwd(), "build/src/worker/bundleVerifier.js"),
  maxThreads: BUNDLE_VERIFY_CONCURRENCY,
  name: "verifyBundle",
  concurrentTasksPerWorker: 2,
});

bundleVerifier.on("error", (...args) => {
  logger.error("[bundleVerifier] Worker error: " + JSON.stringify(args));
});
