import BigNumber from "bignumber.js";
import { fallbackPeerRequest } from "./peers";
import logger from "@logger";
import { config } from "./env";

// arweave chunk size
const CHUNK_SIZE = 256 * 1024;

/**
 * Concurrent Arweave transaction downloader - uses fallbackPeerRequest internally
 * to download a transaction via it's Arweave network level chunks with concurrency
 * @param txId - txId to download
 * @param config
 */
export async function* downloadTx(
  txId: string,
  options?: { concurrency?: number; fallbackRequestConfig?: Parameters<typeof fallbackPeerRequest>[1] },
): AsyncGenerator<Buffer | Error> {
  // default concurrency to 100 as the chunks are *tiny* (256kib)
  const opts = { concurrency: config?.request?.defaultDownloadTxConcurrency ?? 100, ...options };
  try {
    const metadata = await fallbackPeerRequest<{ offset: number; size: number }>(`/tx/${txId}/offset`);

    // use big numbers for safety
    const endOffset = new BigNumber(metadata.data.offset);
    const size = new BigNumber(metadata.data.size);
    const startOffset = endOffset.minus(size).plus(1);
    let processedBytes = 0;

    const chunks = Math.ceil(size.dividedBy(CHUNK_SIZE).toNumber());
    // throw new Error("test")
    const getChunk = async (offset: BigNumber): Promise<Buffer | Error> => {
      try {
        // throw new Error("test");
        const then = performance.now();
        const r = await fallbackPeerRequest<{ chunk: string }>(
          `/chunk/${offset.toString()}`,
          opts.fallbackRequestConfig,
        );
        const b = Buffer.from(r.data.chunk, "base64url");
        logger.debug(
          `[getChunk]  ${txId} offset ${offset.toString()} size ${b.length} ${new BigNumber(processedBytes)
            .dividedBy(size)
            .multipliedBy(100)
            .toFixed(2)
            .toString()} % (${processedBytes}/${size.toString()}) - took ${(performance.now() - then).toFixed(3)}ms`,
        );
        processedBytes += b.length;
        return b;
      } catch (e) {
        return e as Error;
      }
    };

    const processing: ReturnType<typeof getChunk>[] = [];
    // only parallelise everything except last two chunks.
    // last two due to merkle rebalancing due to minimum chunk size, see https://github.com/ArweaveTeam/arweave-js/blob/ce441f8d4e66a2524cfe86bbbcaed34b887ba193/src/common/lib/merkle.ts#LL53C19-L53C19
    const parallelChunks = chunks - 2;

    const concurrency = Math.min(parallelChunks, opts.concurrency);
    let currChunk = 0;

    logger.debug(
      `[downloadTx] Tx ${txId} start ${startOffset} size ${size} chunks ${chunks} concurrency ${concurrency}`,
    );

    for (let i = 0; i < concurrency; i++) processing.push(getChunk(startOffset.plus(CHUNK_SIZE * currChunk++)));

    while (currChunk < parallelChunks) {
      processing.push(getChunk(startOffset.plus(CHUNK_SIZE * currChunk++)));
      // yield await so that processedBytes works properly
      yield processing.shift()!;
    }

    while (processing.length > 0) yield processing.shift()!;

    yield getChunk(startOffset.plus(CHUNK_SIZE * currChunk++));
    if (size.isGreaterThan(processedBytes)) yield getChunk(startOffset.plus(CHUNK_SIZE * currChunk++));

    if (!size.isEqualTo(processedBytes)) throw new Error(`got ${processedBytes}B, expected ${size.toString()}B`);

    return;
  } catch (e: unknown) {
    if (e instanceof Error) {
      e.message = "[downloadTx] " + e.message;
    }
    throw e;
  }
}
