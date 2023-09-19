import { CronJob } from "cron";
import logger from "@logger";
import { crawlForPeers } from "./peers";
import { verifyBundles } from "./verifyBundles";
import { getAllNodePostedBundles } from "./getBundles";
import { resolveOrphanTxs } from "@/worker/resolver";
import { pruneOldBundles, pruneOldTxs } from "./prune";
import { processInvalidTxs } from "./invalidTxs";

export async function registerCrons(): Promise<void> {
  createCron("Crawl for peers", "*/30 * * * * *", crawlForPeers);
  createCron("Prune old txs", "15 */1 * * * *", pruneOldTxs);
  createCron("Prune old bundles", "45 */5 * * * *", pruneOldBundles);
  createCron("Verify bundles", "*/15 * * * * *", verifyBundles);
  createCron("Resolve orphan transactions", "0 */1 * * * *", resolveOrphanTxs);
  createCron("Process invalid transactions", "0 */1 * * * *", processInvalidTxs);

  // createCron("Verification chain", "0 */1 * * * *", async () => {
  //   // do these in order so we don't have issues with race conditions between verification steps on slower instances
  //   await verifyBundles(); // index all bundles
  //   await resolveOrphanTxs(); // locate orphans
  //   await processInvalidTxs(); // process any invalid txs
  // });
  createCron("Get posted bundles", "*/30 * * * * * ", getAllNodePostedBundles);
}

export function createCron(name: string, time: string, fn: () => Promise<void>): void {
  let jobLocked = false;
  try {
    new CronJob(
      time,
      async function () {
        if (!jobLocked) {
          jobLocked = true;
          await fn().catch((e) => logger.error(`[cron] Error occurred while doing ${name} - ${e}`));
          jobLocked = false;
        }
      },
      null,
      true,
    );
  } catch (e: any) {
    logger.error(`[cron] Error occurred while creating cron ${name} - ${e}`);
    process.exit(1);
  }
}
