import { retryRequest } from "@utils/axios";
import { GATEWAY_URL, MAX_PEER_DEPTH } from "@utils/env";
import { addPeers } from "@utils/peers";
import logger from "@logger";

export async function crawlForPeers(maxDepth = MAX_PEER_DEPTH): Promise<void> {
  logger.info("[crawlForPeers] Crawling for peers");
  await addPeers([new URL(GATEWAY_URL.toString())]);
  await getPeers(GATEWAY_URL, maxDepth, 0);
  logger.info("[crawlForPeers] Finished crawling for peers");
}

async function getPeers(peer: URL, maxDepth: number, depth = 0): Promise<void> {
  if (depth >= maxDepth) return;
  logger.debug(`[getPeers] Getting peers from ${peer} - at depth ${depth}`);
  try {
    const response = await retryRequest(peer + "/peers", { method: "get", timeout: 3000 });
    const peers = (response.data as string[]).map((v) => new URL("http://" + v));
    logger.verbose(`[getPeers] Got ${peers.length} peers from ${peer}`);
    if (peers) await addPeers(peers);
    for (const p of peers) await getPeers(p, maxDepth, depth + 1);
  } catch (e: any) {
    logger.verbose(`[getPeers] Error occurred while getting peers: ${e}`);
  }
}
