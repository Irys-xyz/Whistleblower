import { registerCrons } from "@/jobs/cron";
import database from "@/db/sqlite";
import { type Bundles, type Bundlers } from "@/types/db";
import { startWsListener } from "@/worker/listener";
import logger from "@logger";
import { getNetworkHeight } from "@utils/arweave";
import { inspect } from "util";
import "@utils/elu";

process.on("uncaughtException", (error, origin) => {
  logger.error(`[Whistleblower:trap] Caught UncaughtException ${error} - ${inspect(origin)}`);
  process.exit(1);
});
process.on("unhandledRejection", (reason, promise) => {
  logger.error(`[Whistleblower:trap] Caught unhandledRejection ${reason} - ${inspect(promise)}`);
  process.exit(1);
});

(async function (): Promise<void> {
  if (!process.env?.disableMsg)
    console.log(`
  ██╗    ██╗██╗  ██╗██╗███████╗████████╗██╗     ███████╗██████╗ ██╗      ██████╗ ██╗    ██╗███████╗██████╗ 
  ██║    ██║██║  ██║██║██╔════╝╚══██╔══╝██║     ██╔════╝██╔══██╗██║     ██╔═══██╗██║    ██║██╔════╝██╔══██╗
  ██║ █╗ ██║███████║██║███████╗   ██║   ██║     █████╗  ██████╔╝██║     ██║   ██║██║ █╗ ██║█████╗  ██████╔╝
  ██║███╗██║██╔══██║██║╚════██║   ██║   ██║     ██╔══╝  ██╔══██╗██║     ██║   ██║██║███╗██║██╔══╝  ██╔══██╗
  ╚███╔███╔╝██║  ██║██║███████║   ██║   ███████╗███████╗██████╔╝███████╗╚██████╔╝╚███╔███╔╝███████╗██║  ██║
   ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝╚══════╝   ╚═╝   ╚══════╝╚══════╝╚═════╝ ╚══════╝ ╚═════╝  ╚══╝╚══╝ ╚══════╝╚═╝  ╚═╝ By Bundlr
  `);
  const bundlers = await database<Bundlers>("bundlers")
    .select("url")
    .then((v) => v.map((u) => new URL(u.url)))
    .catch((e) => e);

  if (bundlers instanceof Error) {
    logger.error(`[Whistleblower] Unable to get bundler nodes from DB - Have you initialized Whistleblower?`);
    process.exit(1);
  }
  if (bundlers.length === 0) {
    logger.error(`[Whistleblower] 0 registered bundler nodes detected, please add some!`);
    process.exit(1);
  }
  const nowHeight = await getNetworkHeight();

  const latestHeight = await database<Bundles>("bundles")
    .max("block")
    // .where("from_node", "=", url.toString())
    .first()
    .then((v) => v?.["max(`block`)"]);
  if (latestHeight)
    logger.info(
      `[Whistleblower] Last recorded network height: ${latestHeight}, current height: ${nowHeight} - catching up ${
        nowHeight - latestHeight
      } blocks`,
    );

  for (const bundlerUrl of bundlers) {
    logger.info(`[Whistleblower] Starting listener for ${bundlerUrl.host}`);
    await startWsListener(`ws://${bundlerUrl.host}`);
  }

  await registerCrons();
})().catch((e) => {
  logger.error(`[Whistleblower:catch] Caught error ${e}`);
  process.exit(1);
});
