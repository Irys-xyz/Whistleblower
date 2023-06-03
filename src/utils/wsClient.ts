import logger from "./logger";
import { WebSocket } from "ws";

/**
 *
 * @param nodeWsUrl - Url in the form `ws://node1.bundlr.network/<path>`
 * @param messageProcessor
 */
export async function initWs(nodeWsUrl: URL, messageProcessor: (msg: Buffer) => Promise<void>): Promise<WebSocket> {
  const connection = new WebSocket(nodeWsUrl) as WebSocket & { pingTimeout: NodeJS.Timeout };
  const hbeat = heartbeat.bind(connection, nodeWsUrl);
  connection.on("error", (e) => logger.error(`[ws] ${nodeWsUrl} Error - ${e} `));
  connection.on("open", hbeat);
  connection.on("ping", () => hbeat());
  connection.on("close", function clear() {
    clearTimeout((this as typeof connection).pingTimeout);
    logger.warn(`[ws] reconnecting ${nodeWsUrl}`);
    // todo: add reconnection backoff after n failures, pattern exp.
    initWs(nodeWsUrl, messageProcessor);
  });
  connection.on("message", messageProcessor);
  logger.verbose(`[ws] connected to ${nodeWsUrl}`);
  return connection;
}

function heartbeat(this: WebSocket & { pingTimeout: NodeJS.Timeout }, nodeWsUrl: URL): void {
  logger.debug(`[ws] Refreshing timeout for ${nodeWsUrl}`);
  if (this.pingTimeout) return void this.pingTimeout.refresh();
  // Use `WebSocket#terminate()`, which immediately destroys the connection,
  // instead of `WebSocket#close()`, which waits for the close timer.
  // Delay should be equal to the interval at which your server
  // sends out pings plus a conservative assumption of the latency.
  this.pingTimeout = setTimeout(() => {
    logger.error(`[ws:heartbeat] Timing out ${nodeWsUrl}`);
    this.terminate();
  }, 30000 + 5000);
}
