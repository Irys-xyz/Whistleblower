import { registerCrons } from "@/jobs/cron";
import database from "@/db/sqlite";
import { type Bundles, type Bundlers } from "@/types/db";
import { startWsListener } from "@/worker/listener";
import logger from "@logger";
import { getNetworkHeight } from "@utils/arweave";
import { inspect } from "util";
import "@utils/elu";
import { sleep } from "@utils";
import { registerHandler } from "segfault-handler";

process.on("uncaughtException", (error, origin) => {
  logger.error(`[Whistleblower:trap] Caught UncaughtException ${error} - ${inspect(origin)}`);
  sleep(2_000).then((_) => process.exit(1));
});
process.on("unhandledRejection", (reason, promise) => {
  logger.error(`[Whistleblower:trap] Caught unhandledRejection ${reason} - ${inspect(promise)}`);
  sleep(2_000).then((_) => process.exit(1));
});

registerHandler("crash.log");

process.on("SIGINT", () => {
  logger.warn(`[Whistleblower:sigint] Received SIGINT, shutting down...`);
  // @ts-expect-error signal
  process.emit("beforeExit", "SIGINT");
  sleep(5_000).then((_) => process.exit(0));
});

(async function (): Promise<void> {
  if (!process.env?.disableMsg)
    console.log(`
  ██╗    ██╗██╗  ██╗██╗███████╗████████╗██╗     ███████╗██████╗ ██╗      ██████╗ ██╗    ██╗███████╗██████╗ 
  ██║    ██║██║  ██║██║██╔════╝╚══██╔══╝██║     ██╔════╝██╔══██╗██║     ██╔═══██╗██║    ██║██╔════╝██╔══██╗
  ██║ █╗ ██║███████║██║███████╗   ██║   ██║     █████╗  ██████╔╝██║     ██║   ██║██║ █╗ ██║█████╗  ██████╔╝
  ██║███╗██║██╔══██║██║╚════██║   ██║   ██║     ██╔══╝  ██╔══██╗██║     ██║   ██║██║███╗██║██╔══╝  ██╔══██╗
  ╚███╔███╔╝██║  ██║██║███████║   ██║   ███████╗███████╗██████╔╝███████╗╚██████╔╝╚███╔███╔╝███████╗██║  ██║
   ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝╚══════╝   ╚═╝   ╚══════╝╚══════╝╚═════╝ ╚══════╝ ╚═════╝  ╚══╝╚══╝ ╚══════╝╚═╝  ╚═╝ By Irys
  `);
  const bundlers = await database<Bundlers>("bundlers")
    .select("url")
    .queryContext({ timeout: 1_000 })
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
    .max("block", { as: "max" })
    // .where("from_node", "=", url.toString())
    .first()
    .then((v) => v?.max);
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
  sleep(2_000).then((_) => process.exit(1));
});
