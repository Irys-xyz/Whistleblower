import database from "@/db/sqlite";
import { type Bundles } from "@/types/db";
import logger from "@logger";
import { getNetworkHeight } from "@utils/arweave";
import { bundleVerifier } from "@/worker/pool";

export async function verifyBundles(): Promise<void> {
  // get unverified bundles
  const bundlesToProcess = await database<Bundles>("bundles")
    .select("tx_id")
    .whereNull("is_valid")
    .andWhere("block", "<=", (await getNetworkHeight()) - 50)
    .limit(250)
    .then((v) => v.map((x) => x.tx_id));

  // chunk processing to 250 per batch - this is done so older bundles that need retries are able to
  // get them when backlog is high.

  logger.verbose(`[verifyBundles] verifying ${bundlesToProcess.length} bundles`);
  if (bundlesToProcess.length >= 100)
    logger.warn(
      `[verifyBundles] high waiting bundles count (${
        bundlesToProcess.length === 250 ? "250+" : bundlesToProcess.length
      })`,
    );

  const processing = bundlesToProcess.map((b) => bundleVerifier.run(b));

  await Promise.allSettled(processing);
}
