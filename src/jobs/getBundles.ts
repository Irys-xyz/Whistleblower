import database from "@/db/sqlite";
import { type IntRange } from "@/types";
import { type Bundlers, type Bundles } from "@/types/db";
import { fmtError } from "@utils";
import { arweave, getNetworkHeight } from "@utils/arweave";
import { retryRequest } from "@utils/axios";
import { getPublicKey } from "@utils/bundler";
import { GATEWAY_URL, START_HEIGHT } from "@utils/env";
import logger from "@logger";

export async function getAllNodePostedBundles(): Promise<void> {
  const nodes = await database<Bundlers>("bundlers")
    .select("url")
    .then((v) => v.map((x) => new URL(x.url)));

  for (const nodeUrl of nodes) {
    await getPostedBundles(nodeUrl);
  }
}

export async function getPostedBundles(
  url: URL,
  config?: { sinceHeight?: number; count?: IntRange<1, 101> },
): Promise<void> {
  const sinceHeight =
    (config?.sinceHeight ??
      (await database<Bundles>("bundles")
        .max("block")
        .where("from_node", "=", url.toString())
        .first()
        .then((v) => v?.["max(`block`)"])) ??
      START_HEIGHT ??
      (await getNetworkHeight())) - 51;

  logger.verbose(`[getPostedBundles] Syncing from ${sinceHeight} for ${url.toString()}`);

  const pubKey = await getPublicKey(url).catch(
    (e) => void logger.debug(`[getPostedBundles:pubKey] Getting pubkey for ${url.toString()} failed - ${fmtError(e)}`),
  );

  if (!pubKey)
    return void logger.error(`[getPostedBundles:pubKey] Unable to get pubkey/url for bundler with name ${url}`);
  const address = await arweave.wallets.ownerToAddress(pubKey);

  let received: GQLRes["data"]["edges"] = [];
  let nextCursor: string | undefined = undefined;
  // TODO: general GQL abstraction & bundler node GQL fallback
  let postedBundles = 0;
  let newBundles = 0;
  do {
    const query = ` query {
        transactions (
            first: ${config?.count ?? 100},
            sort: HEIGHT_ASC,
            owners: ["${address}"],
            block: {
                min: ${sinceHeight}
            }
            ${nextCursor ? `,after: "${nextCursor}"` : ""}
        )
        ${queryFields}
    }`;
    const res = await retryRequest<GQLRes>(new URL("/graphql", GATEWAY_URL), {
      data: { query },
      method: "post",
      headers: { "content-type": "application/json" },
    });
    const hasNextPage = res.data.data.transactions.pageInfo.hasNextPage;
    received = res.data.data.transactions.edges;
    nextCursor = hasNextPage ? received.at(-1)?.cursor : undefined;
    if (hasNextPage)
      logger.debug(`[getPostedBundles] At height ${received.at(-1)?.node.block.height} for ${url.toString()}`);
    // filter out non bundle txs
    const filteredTxs = received.filter((v) =>
      v.node.tags.some((t) => t.name === "Bundle-Version" && t.value === "2.0.0"),
    );
    // add bundles to the DB - 0len check for sqlite
    if (filteredTxs.length !== 0) {
      const newBundlesCount = await database<Bundles>("bundles")
        .insert(
          filteredTxs.map((v) => ({
            tx_id: v.node.id,
            block: v.node.block.height,
            from_node: url.toString(),
            date_created: new Date(),
            verify_attempts: 0,
          })),
          "tx_id",
        )
        .onConflict("tx_id")
        .ignore()
        .queryContext({ name: "bundleInsert" });
      newBundles += newBundlesCount.length;
      postedBundles += filteredTxs.length;
    }
  } while (nextCursor);
  logger.info(`[getPostedBundles] Got ${postedBundles} bundles (${newBundles} new) for ${url.toString()}`);
}

type GQLRes = {
  data: {
    transactions: { pageInfo: { hasNextPage: boolean } };
    edges: {
      cursor: string;
      node: { id: string; tags: { name: string; value: string }[]; block: { id: string; height: number } };
    }[];
  };
};

const queryFields = `{
    pageInfo {
        hasNextPage
    }
    edges {
      cursor
      node {
        id
        tags {
            name
            value
        }
        block {
          id
          height
        }
        }
      }
    }
  `;
