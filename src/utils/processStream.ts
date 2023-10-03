import {
  MIN_BINARY_SIZE,
  SIG_CONFIG,
  type Tag,
  byteArrayToLong,
  deepHash,
  deserializeTags,
  indexToType,
  stringToBuffer,
} from "arbundles/node";
import { type Readable, Transform } from "stream";
import base64url from "base64url";
import { createHash } from "crypto";
import logger from "@logger";
import { fmtErrorConcise } from "@utils";

const DATA_SRC_FAILURE_CODE = "dataSourceFailure";

export type ProcessedItem = {
  id: string;
  sigName: any;
  signature: string;
  target: string;
  anchor: string;
  owner: string;
  tags: Tag[];
  dataOffset: any;
  dataSize: number;
};

export type ProcessStreamReturn = {
  items: ProcessedItem[];
  errors: {
    id: string;
    error: Error;
  }[];
};

export default async function processStream(stream: Readable): Promise<ProcessStreamReturn> {
  stream.on("error", (e) => {
    e.cause = DATA_SRC_FAILURE_CODE;
    logger.error(fmtErrorConcise(e));
  });

  const items: {
    id: string;
    sigName: any;
    signature: string;
    target: string;
    anchor: string;
    owner: string;
    tags: Tag[];
    dataOffset: any;
    dataSize: number;
  }[] = [];
  const errors: { id: string; error: Error }[] = [];

  try {
    let bytes: Uint8Array;

    const reader = getReader(stream);
    // do not use this as the stream will throw from here instead of from within processItem
    // bytes = (await reader.next()).value;

    bytes = Buffer.alloc(0);

    bytes = await readBytes(reader, bytes, 32);
    const itemCount = byteArrayToLong(bytes.subarray(0, 32));
    bytes = bytes.subarray(32);
    const headersLength = 64 * itemCount;
    bytes = await readBytes(reader, bytes, headersLength);

    const headers: [number, string][] = new Array(itemCount);
    for (let i = 0; i < headersLength; i += 64) {
      headers[i / 64] = [
        byteArrayToLong(bytes.subarray(i, i + 32)),
        base64url(Buffer.from(bytes.subarray(i + 32, i + 64))),
      ];
    }

    bytes = bytes.subarray(headersLength);

    let offsetSum = 32 + headersLength;

    // impure, do not run concurrently

    const processItem = async (
      length: number,
      id: string,
    ): Promise<
      | Error
      | {
          id: string;
          sigName: any;
          signature: string;
          target: string;
          anchor: string;
          owner: string;
          tags: Tag[];
          dataOffset: any;
          dataSize: number;
        }
    > => {
      try {
        bytes = await readBytes(reader, bytes, MIN_BINARY_SIZE);

        // Get sig type
        bytes = await readBytes(reader, bytes, 2);
        const signatureType = byteArrayToLong(bytes.subarray(0, 2));
        bytes = bytes.subarray(2);

        const { sigLength, pubLength, sigName } = SIG_CONFIG[signatureType];

        // Get sig
        bytes = await readBytes(reader, bytes, sigLength);
        const signature = bytes.subarray(0, sigLength);
        bytes = bytes.subarray(sigLength);

        // Get owner
        bytes = await readBytes(reader, bytes, pubLength);
        const owner = bytes.subarray(0, pubLength);
        bytes = bytes.subarray(pubLength);

        // Get target
        bytes = await readBytes(reader, bytes, 1);
        const targetPresent = bytes[0] === 1;
        if (targetPresent) bytes = await readBytes(reader, bytes, 33);
        const target = targetPresent ? bytes.subarray(1, 33) : Buffer.allocUnsafe(0);
        bytes = bytes.subarray(targetPresent ? 33 : 1);

        // Get anchor
        bytes = await readBytes(reader, bytes, 1);
        const anchorPresent = bytes[0] === 1;
        if (anchorPresent) bytes = await readBytes(reader, bytes, 33);
        const anchor = anchorPresent ? bytes.subarray(1, 33) : Buffer.allocUnsafe(0);
        bytes = bytes.subarray(anchorPresent ? 33 : 1);

        // Get tags
        bytes = await readBytes(reader, bytes, 8);
        const tagsLength = byteArrayToLong(bytes.subarray(0, 8));
        bytes = bytes.subarray(8);

        bytes = await readBytes(reader, bytes, 8);
        const tagsBytesLength = byteArrayToLong(bytes.subarray(0, 8));
        bytes = bytes.subarray(8);

        // Get offset of data start and length of data
        const dataOffset =
          2 + sigLength + pubLength + (targetPresent ? 33 : 1) + (anchorPresent ? 33 : 1) + 16 + tagsBytesLength;
        const dataSize = length - dataOffset;

        // anything past this is recoverable

        bytes = await readBytes(reader, bytes, tagsBytesLength);
        const tagsBytes = bytes.subarray(0, tagsBytesLength);
        const tags = tagsLength !== 0 && tagsBytesLength !== 0 ? deserializeTags(Buffer.from(tagsBytes)) : [];
        if (tags.length !== tagsLength) throw new Error("Tags lengths don't match");
        bytes = bytes.subarray(tagsBytesLength);

        const transform = new Transform();
        transform._transform = function (chunk, _, done): void {
          this.push(chunk);
          done();
        };

        // Verify signature
        const signatureData = deepHash([
          stringToBuffer("dataitem"),
          stringToBuffer("1"),
          stringToBuffer(signatureType.toString()),
          owner,
          target,
          anchor,
          tagsBytes,
          transform,
        ]);

        if (bytes.byteLength > dataSize) {
          transform.write(bytes.subarray(0, dataSize));
          bytes = bytes.subarray(dataSize);
        } else {
          let skipped = bytes.byteLength;
          transform.write(bytes);
          while (dataSize > skipped) {
            bytes = (await reader.next()).value;
            if (!bytes) {
              throw new Error(`Not enough data bytes  expected: ${dataSize} received: ${skipped}`);
            }

            skipped += bytes.byteLength;

            if (skipped > dataSize) transform.write(bytes.subarray(0, bytes.byteLength - (skipped - dataSize)));
            else transform.write(bytes);
          }
          bytes = bytes.subarray(bytes.byteLength - (skipped - dataSize));
        }

        transform.end();

        // Check id
        if (id !== base64url(createHash("sha256").update(signature).digest()))
          throw new Error("ID doesn't match signature");

        const Signer = indexToType[signatureType];

        if (!(await Signer.verify(owner, (await signatureData) as any, signature)))
          throw new Error("Invalid signature");

        /*  items.push( */ const item = {
          id,
          sigName,
          signature: base64url(Buffer.from(signature)),
          target: base64url(Buffer.from(target)),
          anchor: base64url(Buffer.from(anchor)),
          owner: base64url(Buffer.from(owner)),
          tags,
          dataOffset: offsetSum + dataOffset,
          dataSize,
        };

        offsetSum += dataOffset + dataSize;
        return item;
      } catch (e) {
        return e as Error;
      }
    };

    for (const [length, id] of headers) {
      const res = await processItem(length, id);
      if (res instanceof Error) {
        logger.debug(`[processStream] Got Error ${res} for ${id}`);
        if (res.cause === DATA_SRC_FAILURE_CODE) throw new ProcessStreamFailure(res, { items, errors });
        errors.push({ id, error: res });
      } else {
        items.push(res);
      }
    }

    return { items, errors };
  } catch (e: any) {
    e.cause = "processStream";
    throw new ProcessStreamFailure(e, { items, errors });
  }
}

async function readBytes(reader: AsyncGenerator<Buffer>, buffer: Uint8Array, length: number): Promise<Uint8Array> {
  if (buffer.byteLength >= length) return buffer;

  const { done, value } = await reader.next();

  if (done && !value) throw new Error("Invalid buffer");

  return readBytes(reader, Buffer.concat([Buffer.from(buffer), Buffer.from(value)]), length);
}

async function* getReader(s: Readable): AsyncGenerator<Buffer> {
  for await (const chunk of s) {
    if (chunk instanceof Error) {
      chunk.cause = DATA_SRC_FAILURE_CODE;
      throw chunk;
    }
    yield chunk;
  }
}

export class ProcessStreamFailure extends Error {
  public processStreamReturn: ProcessStreamReturn;
  public primaryError: Error;
  constructor(primaryError: Error, psReturn: ProcessStreamReturn) {
    super(fmtErrorConcise(primaryError));
    this.primaryError = primaryError;
    this.processStreamReturn = psReturn;
  }
}
