import database from "@/db/sqlite";
import { type Bundles } from "@/types/db";
import logger from "@logger";
// import { verifyBundle } from "@/worker/bundleVerifier";
// import PromisePool from "@supercharge/promise-pool/dist";
// import { BUNDLE_VERIFY_CONCURRENCY } from "@utils/env";
import { getNetworkHeight } from "@utils/arweave";
import { bundleVerifier } from "@/worker/pool";

export async function verifyBundles(): Promise<void> {
  // get unverified bundles
  const bundlesToProcess = await database<Bundles>("bundles")
    .select("tx_id")
    .whereNull("is_valid")
    .andWhere("block", "<=", (await getNetworkHeight()) - 50)
    .then((v) => v.map((x) => x.tx_id));

  logger.verbose(`[verifyBundles] verifying ${bundlesToProcess.length} bundles`);
  if (bundlesToProcess.length >= 100)
    logger.warn(`[verifyBundles] high waiting bundles count (${bundlesToProcess.length})`);
  // await new PromisePool(bundlesToProcess)
  //   .withConcurrency(BUNDLE_VERIFY_CONCURRENCY)
  //   .process((bundleId) => verifyBundle(bundleId));
  // const donePromise = new Promise((r) => bundleVerifier.on("drain", r));
  const processing = bundlesToProcess.map((b) => bundleVerifier.run(b));

  await Promise.allSettled(processing);
}
