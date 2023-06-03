import { registerCrons } from "@/jobs";
import database from "@/db/sqlite";
import { type Bundlers } from "@/types/db";
import { startWsListener } from "@/worker/listener";
import logger from "@logger";
import { fmtError } from "@utils";

const trap = (err): void => void logger.error(`[Whistleblower:trap] Caught error ${fmtError(err)}`);
process.on("uncaughtException", trap.bind(this, "uncaughtException"));
process.on("unhandledRejection", trap.bind(this, "unhandledRejection"));

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
  await registerCrons();
  const bundlers = await database<Bundlers>("bundlers")
    .select("url")
    .then((v) => v.map((u) => new URL(u.url)));

  if (bundlers.length === 0) {
    logger.error(`[Whistleblower] 0 registered bundler nodes detected, please add some!`);
    process.exit(1);
  }
  for (const bundlerUrl of bundlers) {
    logger.info(`Starting listener for ${bundlerUrl.host}`);
    await startWsListener(`ws://${bundlerUrl.host}`);
  }
})().catch((e) => logger.error(`[Whistleblower:catch] Caught error ${e}`));
