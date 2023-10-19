import { retryRequest } from "./axios";
import database from "@db/sqlite";
import logger from "@logger";
import { type AxiosResponse } from "axios";
import { type Peers } from "@/types/db";
import { asyncPool } from "./asyncPool";
import { GATEWAY_URL } from "./env";
import { shuffleArray } from "@utils";

/**
 * Dispatches request with fallback to peers (in sequence of provided peer shortlist or peers trust)
 * praises/punishes peers based on response behaviour
 * should be used for any requests that can be done on arweave miners
 * @param url - relative URL to request
 * @param config - axios + peers + retry config
 * @returns {AxiosResponse}
 */
export async function fallbackPeerRequest<T = any, R = AxiosResponse<T>>(
  url: string,
  config?: Parameters<typeof retryRequest>[1] & {
    peers?: { shortlist?: URL[]; fallbackCount?: number; praise?: boolean; punish?: boolean; random?: boolean };
    returnOnAllFailure?: boolean;
  },
): Promise<R> {
  const peers =
    config?.peers?.shortlist ?? (await getPeers(config?.peers?.fallbackCount ?? 20, config?.peers?.random ?? true));
  // last resort fallback to GW
  peers.push(new URL(GATEWAY_URL.toString()));
  let oRes;
  for (let i = 0; i < peers.length; i++) {
    // format is url, base
    const peerUrl = new URL(url, peers[i]);
    const res = await retryRequest<T, R>(peerUrl.toString(), { retry: { retries: 1 }, ...config }).catch((e) => {
      logger.debug(`[fallbackPeerRequest] Error getting ${peerUrl.toString()} - ${e.message}`);
      oRes = e.response;
      return undefined;
    });
    if (res) {
      oRes = res;
      // we know previous peers didn't succeed, so we penalise them.
      const badPeers = peers.slice(0, i);
      // do not block for these updates
      // TODO: depending on DB util, disable/reduce activity caused by this
      if (config?.peers?.punish ?? true)
        penalisePeers(badPeers).catch((e) =>
          logger.warn(`[fallbackPeerRequest:penalise] Error penalising ${badPeers} - ${e}`),
        );
      if (config?.peers?.praise ?? true)
        praisePeer(peers[i]).catch((e) =>
          logger.warn(`[fallbackPeerRequest:praise] Error praising ${peers[i]} - ${e}`),
        );
      return res;
    }
  }
  if (config?.returnOnAllFailure) return oRes;
  // no peers succeeded, probably a bad request. no penalisation.
  throw new Error(`[fallbackPeerRequest] Unable to successfully perform request ${url} with ${peers.length} peers`);
}

export async function peerRequest<T = any, R = AxiosResponse<T>>(
  url: URL,
  config?: Parameters<typeof retryRequest>[1],
): Promise<R> {
  try {
    return await retryRequest<T, R>(url.toString(), config);
  } catch (e) {
    const peerUrl = new URL(url.origin);
    penalisePeer(peerUrl);
    throw e;
  }
}

export async function getPeers(count = 10, random = true): Promise<URL[]> {
  const query = random
    ? `select * from (select * from peers order by trust desc limit ${Math.ceil(
        count / 2,
      )}) union select * from (select * from peers order by RANDOM() limit ${Math.ceil(count / 2)})`
    : `select * from peers order by trust desc limit ${count}`;
  // const q = database<Peers>("peers").select("*").where("url", "<>", GATEWAY_URL.toString()).orderBy("trust", "desc");
  // if (random) {
  //   q.limit(Math.ceil(count / 2)).union([
  //     function (): void {
  //       this.select("*")
  //         .where("url", "<>", GATEWAY_URL.toString())
  //         .limit(Math.ceil(count / 2))
  //         .orderByRaw(`RANDOM()`);
  //     },
  //   ]);
  // } else {
  //   q.limit(count);
  // }

  // const query = database<Peers>("peers")
  //   .select("url")
  //   .where("url", "<>", GATEWAY_URL.toString())
  //   .orderBy("trust", "desc")
  //   .limit(count);
  // const query = database.raw(`
  // select * from (select * from peers order by trust desc limit 10) union select * from (select * from peers order by RANDOM() limit 4);
  // `)
  // if (random)
  let qRes = await database.raw(query).queryContext({ name: "getPeers" });
  if (random) qRes = shuffleArray(qRes);
  return qRes.map((p) => new URL(p.url));
}

export const penalisePeers = (peers: URL[]): Promise<void[]> => Promise.all(peers.map(async (p) => penalisePeer(p)));

export async function penalisePeer(peer: URL, decrease = 2): Promise<void> {
  // decrease trust by `decrease` until 0
  const oldTrust = await getPeerTrust(peer);
  logger.debug(`[penalisePeer] Penalising ${peer}`);
  if (!oldTrust) return;
  const newTrust = oldTrust - decrease;
  await database<Peers>("peers")
    .update("trust", newTrust < 0 ? 0 : newTrust)
    .where("url", "=", peer.toString());
}

export const praisePeers = (peers: URL[]): Promise<void[]> => Promise.all(peers.map(async (p) => penalisePeer(p)));

export async function getPeerTrust(peer: URL): Promise<number> {
  return await database<Peers>("peers")
    .select("trust")
    .where("url", "=", peer.toString())
    .first()
    .queryContext({ name: "getPeerTrust" })
    .then((v) => v?.trust ?? 0);
}

export async function praisePeer(peer: URL): Promise<void> {
  const oldTrust = await getPeerTrust(peer);
  logger.debug(`[praisePeer] Praising peer ${peer}`);
  const newTrust = oldTrust + repIncrease(oldTrust);
  await database<Peers>("peers")
    .update({ trust: newTrust > 100 ? 100 : newTrust, last_praised: new Date() })
    .where("url", "=", peer.toString());
}

export async function addPeers(peers: URL[], startingTrust = 10): Promise<void> {
  const finalPeers: Pick<Peers, "url" | "trust" | "date_created">[] = [];

  for await (const res of asyncPool(20, peers, async (peer): Promise<URL | undefined> => {
    const inDB = await database<Peers>("peers")
      .select("url")
      .where("url", "=", peer.toString())
      .first()
      .queryContext({ name: "peerInDB" })
      .then((v) => !!v?.url);

    if (inDB) return undefined;

    return await retryRequest(new URL("/info", peer), { retry: { retries: 1 }, timeout: 5_000 })
      .then((r) => (r.data.release >= 57 ? peer : undefined))
      .catch((_) => undefined);
  })) {
    if (res) finalPeers.push({ url: res.toString(), trust: startingTrust, date_created: new Date() });
  }
  logger.verbose(`[addPeers] Added ${finalPeers.length} new peers`);
  if (finalPeers.length > 0)
    await database<Peers>("peers").insert(finalPeers).onConflict("url").ignore().queryContext({ name: "peersInsert" });
}

// math
// export const repIncrease = (rep: number, h = 0.001): number => rep + (16 * baseLog(2, rep + 1 + h) - 16 * baseLog(2, rep + 1 - h)) / (2 * h);
export const repIncrease = (rep: number): number => 50 / (rep / 30.5 + 3) - 8;

export const baseLog = (x: number, y: number): number => Math.log(y) / Math.log(x);
