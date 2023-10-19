import database from "@/db/sqlite";
import { type Bundles } from "@/types/db";
import logger from "@logger";
import { getNetworkHeight } from "@utils/arweave";
import { bundleVerifier } from "@/worker/pool";
import { BUNDLE_VERIFY_MIN_RETRY_INTERVAL, MAX_BUNDLE_VERIFY_ATTEMPTS } from "@utils/env";

const VERIFY_BUNDLES_BATCH_SIZE = 20;

export async function verifyBundles(): Promise<void> {
  // get unverified bundles
  const bundlesToProcess = await database<Bundles>("bundles")
    .select("tx_id")
    // retry not valid (not the same as invalid!) bundles
    .where("is_valid", "<>", true)
    // with enough time to be immune to a fork
    .andWhere("block", "<=", (await getNetworkHeight()) - 50)
    // until we've tried too many times
    .andWhere("verify_attempts", "<", MAX_BUNDLE_VERIFY_ATTEMPTS)
    // make sure there's at least BUNDLE_VERIFY_MIN_RETRY_INTERVAL ms between attempts
    .andWhere("date_last_verified", "<", new Date(Date.now() - BUNDLE_VERIFY_MIN_RETRY_INTERVAL))
    // limit so we can retry older bundles faster if we have a massive backlog
    .limit(VERIFY_BUNDLES_BATCH_SIZE)
    .queryContext({ name: "bundlesToProcess" })
    .then((v) => v.map((x) => x.tx_id));

  logger.verbose(`[verifyBundles] verifying ${bundlesToProcess.length} bundles`);
  if (bundlesToProcess.length === VERIFY_BUNDLES_BATCH_SIZE)
    logger.warn(`[verifyBundles] High number of bundles waiting for verification (${bundlesToProcess.length}+)`);

  // TODO: add a hard timeout to verifier jobs so a single job can't deadlock WB's verification pipeline
  const processing = bundlesToProcess.map((b) => bundleVerifier.run(b));

  await Promise.allSettled(processing);
}
