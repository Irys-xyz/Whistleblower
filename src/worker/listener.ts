import logger from "@logger";
import { sleep } from "@utils";
import { initWs } from "@utils/wsClient";
import { type WsString } from "@/types/config";
import { type SignedReceiptBody, type Transaction } from "@/types/bundler";
import { insertReceipt, insertTransaction } from "@db/transactions";
import { ENABLE_TPS_COUNTER } from "@utils/env";

export async function startWsListener(
  wsNodeUrl: WsString,
  options?: { listenForTxs?: boolean; listenForReceipts?: boolean },
): Promise<void> {
  // increase below if the latency between the two connections is too high
  // TODO: adjust dynamically based on duplicate DB inserts?
  const lastMessageBufferLength = 5;
  // have two connections, created with different timings to reduce the chance of missing transactions
  const opts = { listenForTxs: true, listenForReceipts: true, ...options };

  let tps = 0;
  setInterval(() => {
    if (ENABLE_TPS_COUNTER) logger.verbose(`[tps] ${wsNodeUrl} Tx TPS: ${tps}`);
    tps = 0;
  }, 1_000);

  if (opts.listenForTxs) {
    const lastMsgs: string[] = new Array(lastMessageBufferLength);
    let index = 0;
    const txProcessor = async (message: Buffer): Promise<void> => {
      const msg = message.toString();
      // dedupe messages
      if (lastMsgs.includes(msg)) return;
      // we don't care about ordering so we just replace the oldest message ring buffer style
      lastMsgs[(index = index < lastMessageBufferLength - 1 ? index + 1 : 0)] = msg;
      // process message
      tps++;
      // TODO: filter the Tx now
      // insert into DB
      const tx: Transaction = JSON.parse(msg);
      // logger.debug(msg);
      if (tx.parent) return;
      await insertTransaction(tx);
    };
    await initWs(new URL(wsNodeUrl + "/ws/transactions"), txProcessor);
    sleep(1_000).then((_) => initWs(new URL(wsNodeUrl + "/ws/transactions"), txProcessor));
  }

  if (opts.listenForReceipts) {
    const lastMsgs: string[] = new Array(lastMessageBufferLength);
    let index = 0;
    const receiptProcessor = async (message: Buffer): Promise<void> => {
      const msg = message.toString();
      if (lastMsgs.includes(msg)) return;
      lastMsgs[(index = index < lastMessageBufferLength - 1 ? index + 1 : 0)] = msg;
      // logger.debug(msg);
      tps++;
      const tx: SignedReceiptBody = JSON.parse(msg);

      await insertReceipt(tx);
    };
    await initWs(new URL(wsNodeUrl + "/ws/receipts"), receiptProcessor);
    sleep(1_000).then((_) => initWs(new URL(wsNodeUrl + "/ws/receipts"), receiptProcessor));
  }
}
