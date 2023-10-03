// worker process spawned whenever a bundle/tx needs to be verified
import database from "@db/sqlite";
import { type Bundles, type Transactions } from "@/types/db";
import { fmtErrorConcise, sleep } from "@utils";
import logger from "@logger";
import { downloadTx } from "@utils/txDownloader";
import { Readable } from "stream";
import processStream, { ProcessStreamFailure, ProcessStreamReturn, type ProcessedItem } from "@utils/processStream";
import { alert } from "@utils/alert";
import { fallbackPeerRequest } from "@utils/peers";
import BigNumber from "bignumber.js";
import axios from "axios";
import { inspect } from "util";
import { MAX_BUNDLE_VERIFY_ATTEMPTS } from "@utils/env";
import piscina from "piscina";
import { BundleAlertCodes } from "@/types/alert";

// only add handlers if we're in a worker thread
if (piscina.isWorkerThread) {
  // Note: sefault handler doesn't load properly in worker threads.
  process.on("uncaughtException", (error, origin) => {
    logger.error(`[Whistleblower:trap] Caught UncaughtException ${error} - ${inspect(origin)}`);
    sleep(2_000).then((_) => process.exit(1));
  });
  process.on("unhandledRejection", (reason, promise) => {
    logger.error(`[Whistleblower:trap] Caught unhandledRejection ${reason} - ${inspect(promise)}`);
    sleep(2_000).then((_) => process.exit(1));
  });
} else {
  logger.warn(
    `verifyBundle is designed to be run in a worker thread, while it will work outside of one this is not advised due to potential event loop congestion`,
  );
}

/**
 * Primary verification function - handles the verification of a dataStream from fallbackPeerRequest, pipes it into processStream
 * and handles the results - errors or otherwise - with a fallback to using the configured gateway directly if FPR fails.
 * @param bundleId - bundle (L1) Tx ID to verify
 * @returns nothing
 */
export async function verifyBundle(bundleId: string): Promise<void> {
  // non-critical so we don't care if this req fails - though odds are if it does then downloadTx will also fail.
  // TODO: figure out good way of getting processed bytes from the iterator/readable itself
  const offsetPromise = fallbackPeerRequest<{ offset: number; size: number }>(`/tx/${bundleId}/offset`).catch(
    (_) => undefined,
  );
  const then = performance.now();
  try {
    // try {
    logger.info(`[verifyBundle] Processing bundle ${bundleId}`);
    // increment verify attempts
    const attempts = await database<Bundles>("bundles")
      .where("tx_id", "=", bundleId)
      .increment("verify_attempts", 1)
      // .update("date_verified", new Date())
      .returning("verify_attempts")
      .then((r) => r?.[0]?.verify_attempts ?? 0);
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
    let minerAttempt: Awaited<ReturnType<typeof processStream>> | Error;
    // eslint-disable-next-line prefer-const
    minerAttempt = new Error("test");

    try {
      const chunkGen = downloadTx(bundleId);
      const readable = Readable.from(chunkGen);
      minerAttempt = await processStream(readable);
    } catch (e: any) {
      logger.error(`[verifyBundle] Error verifying ${bundleId} from peers - ${fmtErrorConcise(e)}`);
      minerAttempt = e;
    }
    // miner verification succeeded
    if (!(minerAttempt instanceof Error) && minerAttempt.errors.length === 0)
      return await handleValidBundle({ bundleId, items: minerAttempt.items });

    // if miners failed, try gateway
    logger.warn(
      `[verifyBundle] Miner based verification of bundle ${bundleId} failed, falling back to gateway download`,
    );

    let gatewayAttempt: Awaited<ReturnType<typeof processStream>> | Error | ProcessStreamFailure;

    try {
      const gwBundleStream = await axios({ url: `https://arweave.net/${bundleId}/data`, responseType: "stream" }).catch(
        (e) => (gatewayAttempt = e),
      );
      gatewayAttempt = await processStream(gwBundleStream.data);
    } catch (e: any) {
      logger.error(`[verifyBundle] Error verifying ${bundleId} from gateway - ${fmtErrorConcise(e)}`);
      gatewayAttempt = e;
    }

    // gateway verification succeeded
    if (!(gatewayAttempt instanceof Error) && gatewayAttempt.errors.length === 0)
      return await handleValidBundle({ bundleId, items: gatewayAttempt.items });

    const isPSError = gatewayAttempt instanceof ProcessStreamFailure;
    const isGenericError = gatewayAttempt instanceof Error;

    // TODO: fix automatic type narrowing

    // log error, if any
    if (isGenericError || isPSError)
      logger.warn(
        `[verifyBundle:attemptError] Failed to fully verify bundle ${bundleId} on attempt ${attempts} due to error ${fmtErrorConcise(
          isPSError ? (gatewayAttempt as ProcessStreamFailure).primaryError : (gatewayAttempt as Error),
        )}`,
      );

    if (isGenericError && !isPSError) return;

    // process stream completed but with some errors ("mixed")

    // extract items and errors
    const { items, errors } =
      gatewayAttempt instanceof ProcessStreamFailure
        ? gatewayAttempt.processStreamReturn
        : (gatewayAttempt as ProcessStreamReturn);

    const itemCount = items.length + errors.length;

    logger.verbose(`[verifyBundle:mixed] Bundle ${bundleId} has ${itemCount} transactions`);
    if (errors.length !== 0) {
      for (const error of errors) {
        logger.warn(
          `[verifyBundle:mixed:error] tx ${error.id} in bundle ${bundleId} verification failed with error ${error.error} - marking as provisionally invalid`,
        );
        // *don't* alert that the tx is invalid, wait until deadline height to alert
        // we do this because it gives time for a bundler to produce a correct bundle containing the tx - which is valid behaviour.
      }
      // add items as invalid
      await database<Transactions>("transactions")
        .whereIn(
          "tx_id",
          errors.map((e) => e.id),
        )
        .update({ is_valid: false, date_last_verified: new Date(), bundled_in: bundleId })
        .queryContext({ name: "updateTxValidity" });
    }
    if (items.length !== 0) {
      // add items as valid
      const mappedTxs = items.map((t) => t.id);
      const presentTxIds = await database<Transactions>("transactions")
        .whereIn("tx_id", mappedTxs)
        .update({ bundled_in: bundleId, is_valid: true, date_last_verified: new Date() }, "tx_id")
        .queryContext({ name: "updateTxValidity" });

      const diff = items.length - presentTxIds.length;
      // TODO: add option to insert/resolve/handle txs in bundle but not caught by listener/in DB
      if (diff > 0)
        logger.warn(
          `[verifyBundle:mixed:missedTxs] Bundle ${bundleId} has ${diff} unaccounted for txs (missed by listener)`,
        );
    }

    // check attempts
    if (attempts >= MAX_BUNDLE_VERIFY_ATTEMPTS) {
      // then this bundle is invalid
      await database<Bundles>("bundles").update({ is_valid: false }).where("tx_id", "=", bundleId);

      await alert({
        type: "bundle",
        reason: `Bundle failed to verify without errors after ${attempts} attempts.`,
        code: BundleAlertCodes.VERIFY_ATTEMPTS_EXHAUSTED,
        info: {
          id: bundleId,
          errors: {
            miner: minerAttempt,
            gateway: gatewayAttempt,
          },
        },
      });
      return;
    }
  } catch (e) {
    logger.error(`[verifyBundle] Unexpected top level error ${fmtErrorConcise(e)}`);
  } finally {
    await database<Bundles>("bundles")
      .update("date_last_verified", new Date())
      .where("tx_id", "=", bundleId)
      .catch((e) =>
        logger.error(`[verifyBundle:dateVerified] Unable to update verification date for ${bundleId} - ${e}`),
      );
    const size = await offsetPromise;
    const timeTaken = (performance.now() - then) / 1000;
    const MBps = size?.data
      ? new BigNumber(size.data.size).dividedBy(1_000_000).dividedBy(timeTaken).toFixed(3)
      : undefined;

    logger.verbose(
      `[verifyBundle:finally] Finished processing ${bundleId} - took ${timeTaken}s ${
        size?.data ? `${new BigNumber(size.data.size).dividedBy(1_000_000).toFixed(3)}MB` : ""
      } ${MBps ? `(${MBps}MB/s)` : ""}`,
    );
  }
}

async function handleValidBundle({ bundleId, items }: { bundleId: string; items: ProcessedItem[] }): Promise<void> {
  // set as valid in DB, updating all
  await database<Bundles>("bundles").update({ is_valid: true }).where("tx_id", "=", bundleId);

  logger.verbose(`[verifyBundle:valid] Bundle ${bundleId} has ${items.length} transactions`);

  const mappedTxs = items.map((t) => t.id);

  // update relations - have to have a 0len check for sqlite
  if (mappedTxs.length !== 0) {
    const presentTxIds = await database<Transactions>("transactions")
      .whereIn("tx_id", mappedTxs)
      .update({ bundled_in: bundleId, is_valid: true }, "tx_id")
      .queryContext({ name: "updateTxValidity" });

    const diff = items.length - presentTxIds.length;
    // TODO: add option to insert/resolve txs in bundle but not caught by listener
    if (diff > 0)
      logger.warn(
        `[verifyBundle:valid:missedTxs] Bundle ${bundleId} has ${diff} unaccounted for txs (missed by listener)`,
      );
  }
}
