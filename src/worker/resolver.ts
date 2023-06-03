// resolves bundle information for txs

import database from "@/db/sqlite";
import { type BlockData } from "@/types/arweave";
import { type Bundlers, type Bundles, type Transactions } from "@/types/db";
import { getNetworkHeight } from "@utils/arweave";
import { retryRequest } from "@utils/axios";
import { GATEWAY_URL } from "@utils/env";
import logger from "@logger";
import { fallbackPeerRequest } from "@utils/peers";
import PromisePool from "@supercharge/promise-pool/dist";

export async function resolveOrphanTxs(/* orphanAgeThreshold = ORPHAN_AGE_THRESHOLD */): Promise<void> {
  const height = await getNetworkHeight();
  // an orphan tx is a tx without a defined parent bundle -
  // we catch these 20 blocks before they expire
  const orphans = await database<Transactions>("transactions")
    .select(["tx_id", "deadline_height"])
    .whereNull("bundled_in")
    .andWhere("deadline_height", "<", height + 20)
    .orderBy("deadline_height", "asc");

  if (orphans.length === 0) return;
  logger.warn(`[resolveOrphanTxs] ${orphans.length} orphan txs`);

  await new PromisePool()
    .for(orphans)
    .withConcurrency(10)
    .process(async (orphan) => {
      const query = `
          query {
          transaction(id: "${orphan.tx_id}"){
            block {
              height
            }
            bundledIn {
              id,
            }
          }
        }`;
      const res = await retryRequest<{
        data: { transaction: { block: { height: number } | null; bundledIn: { id: string } | null } };
      }>(GATEWAY_URL + "/graphql", {
        data: { query },
        method: "post",
        headers: { "content-type": "application/json" },
      });
      const blockInfo = res.data.data.transaction.block;
      const bundledInId = res.data.data.transaction.bundledIn?.id;
      if (!blockInfo) return void logger.verbose(`[resolveOrphanTx] Block is null for ${orphan.tx_id} - delaying`);
      if (bundledInId) {
        // get owner of the bundle from L1
        const ownerQuery = `
        query {
          transaction(id: "${bundledInId}") {
            owner {
              address
            }
          }
        }`;
        const ownerRes = await retryRequest<{
          data: { transaction: { owner: { address?: string } | null } };
        }>(GATEWAY_URL + "/graphql", {
          data: { query: ownerQuery },
          method: "post",
          headers: { "content-type": "application/json" },
        });

        const ownerAddress = ownerRes.data.data.transaction.owner?.address;
        if (!ownerAddress)
          return void logger.error(
            `[resolveOrphanTx] Unable to determine owner for L1 bundle ${bundledInId} for orphan tx ${orphan.tx_id}`,
          );

        const ownerUrl = await database<Bundlers>("bundlers")
          .select("url")
          .where("address", "=", ownerAddress)
          .first()
          .then((v) => v?.url);

        if (!ownerUrl)
          return void logger.error(
            `[resolveOrphanTx] Unable to determine owner(${ownerAddress}) URL for L1 bundle ${bundledInId} for orphan tx ${orphan.tx_id}`,
          );
        logger.warn(`[resolveOrphanTx] Unexpected orphan Tx ${orphan.tx_id} from ${ownerUrl}`);

        await database<Bundles>("bundles")
          .insert({
            tx_id: bundledInId,
            block: blockInfo.height,
            from_node: ownerUrl.toString(),
            date_created: new Date(),
          })
          .onConflict("tx_id")
          .ignore();

        await database<Transactions>("transactions")
          .update("bundled_in", bundledInId)
          .where("tx_id", "=", orphan.tx_id);
        return;
      }
      return;
    });
}

export async function getBlock(blockId: string | number): Promise<BlockData> {
  const info = await fallbackPeerRequest<BlockData>(
    typeof blockId === "string" ? `/block/hash/${blockId}` : `/block/height/${blockId}`,
  );
  return info.data;
}
