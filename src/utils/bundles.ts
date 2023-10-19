// import { fallbackPeerRequest } from "./peers";

import logger from "@logger";
import axios from "axios";
import { MINIMUM_FULL_REPLICAS } from "./env";
import database from "@db/sqlite";
import { type Peers } from "@/types/db";
import PromisePool from "@supercharge/promise-pool";
import { fmtErrorConcise } from "@utils";

// export type BundleMeta = {
//   offset: number;
//   length: number;
//   confirmations: number;
//   replicas: number;
// };
// export async function getBundleMeta(txId: string): Promise<BundleMeta> {
//   // get offset and length
//   const metadata = await fallbackPeerRequest<{ offset: number; size: number }>(`/tx/${txId}/offset`);
//   // get confirmations
// }

export async function hasData(peer: string, txId: string, size: number, offset: number): Promise<boolean> {
  const url = new URL(`/data_sync_record/${+offset - +size + 1}/1`, peer).toString();
  const syncResponse = await axios.get(url, {
    headers: { "Content-Type": "application/json" },
    timeout: 7500,
  });
  if (syncResponse.data.length === 0) return false;
  try {
    // record is in form {<end>: <start>}[]
    const endOffset = +Object.keys(syncResponse.data[0])[0];
    // @ts-expect-error types
    const startOffset = +Object.values(syncResponse.data[0])[0];
    const a = +offset <= endOffset;

    const b = +offset - +size >= startOffset;
    // if the start and end records fit the entire transaction
    if (a && b) {
      // const response = await axios.get(`http://${peer}/tx/${txId}/status`, { timeout: 7500 }).then((r) => ({
      //   blockHeight: r.data.block_height,
      //   confirmations: r.data.number_of_confirmations,
      //   peer,
      // }));
      logger.verbose(`[hasData] ${txId} seeded at ${peer}`);
      // await redisClient.set(REDIS_LAST_SEEDED_KEY, Date.now().toString());
      return true;
    } else {
      throw new Error("[hasData] Node not synced");
    }
  } catch (e) {
    logger.debug(e);
    return false;
  }
}

// TODO: Improve this so we can determine replicas based on sparse instead of full copies
export async function checkReplicas(txId: string, size: number, offset: number): Promise<false | number> {
  const replicaCount = MINIMUM_FULL_REPLICAS;
  try {
    // let peers = [];
    let dbOffset = 0;
    let fullReplicas = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const peers = await database<Peers>("peers").select("url").orderBy("trust", "desc").offset(dbOffset).limit(100);
      if (peers.length === 0) break;
      dbOffset += peers.length;
      await new PromisePool()
        .for(peers.map((p) => p.url))
        .handleError((e, p) => {
          logger.error(
            `[checkReplicas:pool] Error checking replicas for ${txId} with peer ${p} - ${fmtErrorConcise(e)}`,
          );
        })
        .process(async (peer) => {
          const res = await hasData(peer, txId, size, offset);
          if (res) fullReplicas++;
        });
      if (fullReplicas >= replicaCount) return fullReplicas;
    }
    return false;
  } catch (e) {
    logger.error(`[checkReplicas] Error while checking for ${txId} - ${fmtErrorConcise(e)}`);
    return false;
  }
}
