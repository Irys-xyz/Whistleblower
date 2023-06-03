import Arweave from "arweave";
import { GATEWAY_CONFIG } from "./env";
import logger from "./logger";

export const arweave = Arweave.init(GATEWAY_CONFIG);

let cachedHeight: Promise<number> | undefined = undefined;

export async function getNetworkHeight(cacheLifeMs = 10_000): Promise<number> {
  if (cachedHeight) return cachedHeight;
  logger.debug(`[getNetworkHeight] refreshing arweave network info`);
  cachedHeight = arweave.network.getInfo().then((v) => v.height);
  setTimeout(() => (cachedHeight = undefined), cacheLifeMs);
  return cachedHeight;
}
