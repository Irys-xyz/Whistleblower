import { type SignedReceiptBody, type Transaction } from "@/types/bundler";
import database from "./sqlite";
import { getNetworkHeight } from "@utils/arweave";
import { DEBUG, TX_DEADLINE_OFFSET } from "@utils/env";
import { type Transactions } from "@/types/db";
import logger from "@logger";

// TODO: evaluate adding batching to tx inserts, i.e cache and insert at a set interval (like 1s)
export async function insertTransaction(tx: Transaction): Promise<void> {
  const then = performance.now();
  await database<Transactions>("transactions")
    .insert({
      tx_id: tx.id,
      deadline_height: (await getNetworkHeight()) + TX_DEADLINE_OFFSET,
      bundled_in: null,
      date_created: new Date(),
    })
    .onConflict("tx_id")
    .ignore();

  if (DEBUG) logger.debug(`[insertTransaction] inserting ${tx.id} Took ${performance.now() - then}ms`);
}

export async function insertReceipt(tx: SignedReceiptBody): Promise<void> {
  await database<Transactions>("transactions")
    .insert({ tx_id: tx.id, deadline_height: tx.deadlineHeight, bundled_in: null, date_created: new Date() })
    .onConflict("tx_id")
    .merge(["deadline_height"]);
}
