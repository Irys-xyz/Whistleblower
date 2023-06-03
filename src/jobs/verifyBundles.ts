import database from "@/db/sqlite";
import { type Bundles } from "@/types/db";
import logger from "@logger";
import { verifyBundle } from "@/worker/verifier";
import PromisePool from "@supercharge/promise-pool/dist";
import { BUNDLE_VERIFY_CONCURRENCY } from "@utils/env";

export async function verifyBundles(): Promise<void> {
  // get unverified bundles
  const bundlesToProcess = await database<Bundles>("bundles")
    .select("tx_id")
    .whereNull("is_valid")
    .then((v) => v.map((x) => x.tx_id));

  logger.debug(`[verifyBundles] verifying ${bundlesToProcess.length} bundles`);
  if (bundlesToProcess.length >= 100)
    logger.warn(`[verifyBundles] high waiting bundles count (${bundlesToProcess.length})`);
  await new PromisePool(bundlesToProcess)
    .withConcurrency(BUNDLE_VERIFY_CONCURRENCY)
    .process((bundleId) => verifyBundle(bundleId));
}
