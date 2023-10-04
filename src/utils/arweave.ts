import Arweave from "arweave";
import { GATEWAY_CONFIG } from "./env";
import logger from "./logger";
import AsyncRetry from "async-retry";

export const arweave = Arweave.init(GATEWAY_CONFIG);

let cachedHeight: Promise<number | undefined> | undefined = undefined;

export async function getNetworkHeight(cacheLifeMs = 10_000): Promise<number> {
  const cv = await cachedHeight;
  if (cv) return cv;
  logger.debug(`[getNetworkHeight] refreshing arweave network info`);
  // set cachedHeight as a promise so we don't try to get height multiple times when it expires
  cachedHeight = AsyncRetry(async (_) => {
    return await arweave.network.getInfo().then((info) => info.height);
  }).catch((e) => void logger.warn(`[getNetworkHeight] Error updating network height - ${e}`));

  setTimeout(() => (cachedHeight = undefined), cacheLifeMs);
  return getNetworkHeight();
}
