import { type SignedReceiptBody, type Transaction } from "@/types/bundler";
import database from "./sqlite";
import { getNetworkHeight } from "@utils/arweave";
import { TX_DEADLINE_OFFSET } from "@utils/env";
import { type Transactions } from "@/types/db";
import { BatchInserter } from "./batchInsert";

// let txBuffer: {tx_id: string, deadline_height: number, bundled_in: null, date_created: Date}[] = []
const txBuffer = new BatchInserter({
  sink: async (items) => {
    await database<Transactions>("transactions")
      .insert(items)
      .onConflict("tx_id")
      .ignore()
      .queryContext({ name: "transactionInsert" });
  },
});
export async function insertTransaction(tx: Transaction): Promise<void> {
  // if(txBuffer.length < 100){
  await txBuffer.push({
    tx_id: tx.id,
    deadline_height: (await getNetworkHeight()) + TX_DEADLINE_OFFSET,
    bundled_in: null,
    date_created: new Date(),
  });
  // }else{
  //   const b = [...txBuffer]
  //   txBuffer =[]
  //
  // }
}

// let receiptBuffer: {tx_id: string, deadline_height: number, bundled_in: null, date_created: Date}[] = []
const receiptBuffer = new BatchInserter({
  sink: async (items) => {
    await database<Transactions>("transactions")
      .insert(items)
      .onConflict("tx_id")
      .merge(["deadline_height"])
      .queryContext({ name: "receiptInsert" });
  },
});

export async function insertReceipt(tx: SignedReceiptBody): Promise<void> {
  await receiptBuffer.push({
    tx_id: tx.id,
    deadline_height: tx.deadlineHeight,
    bundled_in: null,
    date_created: new Date(),
  });
}
