import { type Bundles, type Transactions } from "@/types/db";
import database from "@/db/sqlite";
import logger from "@logger";
import { getNetworkHeight } from "@utils/arweave";
import { alert } from "@utils/alert";

export async function verifyTxs(): Promise<any> {
  const height = await getNetworkHeight();
  // these txs have passed their deadline height without being validated
  // group by bundled_in
  const invalidHeightTxs = await database<Transactions>("transactions")
    .select("*")
    .where("is_valid", "<>", true)
    .andWhere("deadline_height", "<", height)
    .whereNull("date_verified")
    .orderBy("bundled_in");

  let bundleMeta: Bundles | undefined;

  for (const tx of invalidHeightTxs) {
    // can't find parent bundle - orphan - very bad, potentially not on chain at all
    if (!tx.bundled_in) {
      // use alert
      await alert({
        type: "transaction",
        reason: "orphan transaction - unable to locate parent bundle",
        info: { id: tx.tx_id },
      });
      await database<Transactions>("transactions")
        .update({ is_valid: false, date_verified: new Date() })
        .where("tx_id", "=", tx.tx_id);
      continue;
    }
    // get the bundle info
    if (!bundleMeta || tx.bundled_in !== bundleMeta.tx_id) {
      bundleMeta = await database<Bundles>("bundles")
        .select("*")
        .where("tx_id", "=", tx.bundled_in ?? "")
        .first();

      if (!bundleMeta) {
        logger.error(`[verifyTxs:bundleResolver] Unable to find bundle ${tx.bundled_in}`);
        await database<Transactions>("transactions")
          .update({ is_valid: false, date_verified: new Date() })
          .where("tx_id", "=", tx.tx_id);
        await alert({
          type: "transaction",
          reason: "parent bundle invalid, unable to verify item",
          info: { id: tx.tx_id, ...tx, bundle: bundleMeta },
        });
        continue;
      }
      if (!bundleMeta.date_verified) {
        // hasn't been verified yet, wait.
        continue;
      }
      // if parent bundle is invalid, explains the lack of tx validity
      // is_valid is actually an int...
      if (bundleMeta.is_valid != true) {
        // not having validity means we've irrecoverably failed to parse/verify the bundle - this shouldn't happen, so we'll mark this as a failure/the tx isn't on chain.
        await database<Transactions>("transactions")
          .update({ is_valid: false, date_verified: new Date() })
          .where("tx_id", "=", tx.tx_id);
        await alert({
          type: "transaction",
          reason: "parent bundle invalid, unable to verify item",
          info: { id: tx.tx_id, ...tx, bundle: bundleMeta },
        });
        continue;
      }
    }
    logger.error(`[verifyTxs] Unhandled case for tx ${JSON.stringify(tx)} bundleMeta ${JSON.stringify(bundleMeta)}`);
  }
}
