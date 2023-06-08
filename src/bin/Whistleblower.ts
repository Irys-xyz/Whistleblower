import { registerCrons } from "@/jobs";
import database from "@/db/sqlite";
import { type Bundlers } from "@/types/db";
import { startWsListener } from "@/worker/listener";
import logger from "@logger";

process.on(
  "uncaughtException",
  (error, origin) => void logger.error(`[Whistleblower:trap] Caught UncaughtException ${error} - ${origin}`),
);
process.on("unhandledRejection", (reason, promise) =>
  logger.error(`[Whistleblower:trap] Caught unhandledRejection ${reason} - ${promise}`),
);

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
