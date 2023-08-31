// worker process spawned whenever a bundle/tx needs to be verified
import database from "@/db/sqlite";
import { type Bundles, type Transactions } from "@/types/db";
import { fmtError } from "@utils";
import logger from "@logger";
import { downloadTx } from "@utils/txDownloader";
import { Readable } from "stream";
import processStream from "@utils/processStream";
import { alert } from "@utils/alert";
import { fallbackPeerRequest } from "@utils/peers";

export async function verifyBundle(bundleId: string): Promise<void> {
  try {
    logger.info(`[verifyBundle] Processing bundle ${bundleId}`);
    const then = performance.now();
    // check it's on chain
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const txStatus = await fallbackPeerRequest<{ block_height: number; number_of_confirmations: number } | undefined>(
      `/tx/${bundleId}/status`,
      { returnOnAllFailure: true },
    );

    // shouldn't happen, usually means the tx isn't fully seeded
    if (txStatus.status !== 200) {
      return void logger.error(`[verifyBundle] Bundle ${bundleId} has a non 200 status code - requeueing`);
    }
    if ((txStatus?.data?.number_of_confirmations ?? 0) < 50) {
      return void logger.info(
        `[verifyBundle] Bundle ${bundleId} has not received the required number of confirmations (${txStatus?.data?.number_of_confirmations} < 50)`,
      );
    }
    logger.verbose(`[verifyBundle] Downloading & processing bundle ${bundleId}`);
    // download and verify data
    const res = await processStream(Readable.from(downloadTx(bundleId))).catch((e: Error) => e);

    if (res instanceof Error) {
      // add specific exception to request peer exhaustion
      if (res.toString().includes("fallbackPeerRequest")) {
        return void logger.warn(`[verifyBundle] Error getting tx ${bundleId} from network - requeueing - ${res}`);
      }

      await database<Bundles>("bundles")
        .update({ is_valid: false, date_verified: new Date() })
        .where("tx_id", "=", bundleId);

      await alert({ type: "bundle", reason: res.toString(), info: { id: bundleId } });
      return void logger.error(`[verifyBundle] Error processing bundle ${bundleId} - ${fmtError(res)}`);
    } else {
      const { items, errors } = res;

      if (errors.length !== 0) {
        for (const error of errors) {
          logger.warn(
            `[verifyBundle] tx ${error.id} in bundle ${bundleId} verification failed with error ${error.error}`,
          );
          // alert the invalid Tx
          await alert({
            type: "transaction",
            reason: error.error.toString(),
            info: { id: error.id, bundledIn: bundleId },
          });
        }
        // add items as invalid
        await database<Transactions>("transactions")
          .whereIn(
            "tx_id",
            errors.map((e) => e.id),
          )
          .update({ is_valid: false, date_verified: new Date() });
      }

      await database<Bundles>("bundles")
        .update({ is_valid: true, date_verified: new Date() })
        .where("tx_id", "=", bundleId);

      logger.verbose(`[verifyBundle] Bundle ${bundleId} has ${items.length} transactions`);

      const mappedTxs = items.map((t) => t.id);

      // update relations - have to have a 0len check for sqlite
      if (mappedTxs.length !== 0) {
        const presentTxIds = await database<Transactions>("transactions")
          .whereIn("tx_id", mappedTxs)
          .update({ bundled_in: bundleId, is_valid: true, date_verified: new Date() }, "tx_id");

        const diff = items.length + errors.length - presentTxIds.length;
        // TODO: add option to insert/resolve txs in bundle but not caught by listener
        if (diff > 0)
          logger.warn(`[verifyBundle] Bundle ${bundleId} has ${diff} unaccounted for txs (missed by listener)`);
      }

      logger.verbose(`[verifyBundle] Finished processing ${bundleId} - took ${(performance.now() - then) / 1000}s`);
    }
  } catch (e: any) {
    logger.error(`[verifyBundle] Error verifying ${bundleId} - ${fmtError(e)}`);
  }
}
