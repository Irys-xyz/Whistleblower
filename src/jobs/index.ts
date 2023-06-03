import { CronJob } from "cron";
import logger from "@logger";
import { crawlForPeers } from "./peers";
import { verifyBundles } from "./verifyBundles";
import { getAllNodePostedBundles } from "./getBundles";
import { resolveOrphanTxs } from "@/worker/resolver";
import { pruneOldBundles, pruneOldTxs } from "./prune";
import { verifyTxs } from "./verifyTxs";

export async function registerCrons(): Promise<void> {
  await pruneOldBundles();
  createCron("Crawl for peers", "*/30 * * * * *", crawlForPeers);
  createCron("Verify bundles", "*/15 * * * * *", verifyBundles);
  createCron("Get posted bundles", "*/30 * * * * * ", getAllNodePostedBundles);
  createCron("Check orphan txs", "0 */1 * * * *", resolveOrphanTxs);
  createCron("Prune old txs", "15 */1 * * * *", pruneOldTxs);
  createCron("Prune old bundles", "45 */5 * * * *", pruneOldBundles);
  createCron("Verify Txs", "*/30 * * * * *", verifyTxs);
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
