import database from "@/db/sqlite";
import { type Bundles, type Transactions } from "@/types/db";
import { MAX_BUNDLE_AGE, MAX_TX_AGE, PRESERVE_INVALID_TRANSACTIONS, PRESERVE_INVALID_BUNDLES } from "@utils/env";
import logger from "@logger";
import { dateToString } from "knex/lib/util/string";

export async function pruneOldTxs(maxAge = MAX_TX_AGE, preserveInvalid = PRESERVE_INVALID_TRANSACTIONS): Promise<void> {
  const threshold = new Date(Date.now() - maxAge);
  const query = database<Transactions>("transactions").delete().where("date_created", "<", threshold);
  if (preserveInvalid) query.andWhere("is_valid", "=", true);
  const res = await query;
  if (res > 0) logger.verbose(`[pruneOldTxs] removed ${res} records for txs older than ${dateToString(threshold)}`);
}

export async function pruneOldBundles(
  maxAge = MAX_BUNDLE_AGE,
  preserveInvalid = PRESERVE_INVALID_BUNDLES,
): Promise<void> {
  const threshold = new Date(Date.now() - maxAge);
  const query = database<Bundles>("bundles").delete().where("date_created", "<", threshold);
  if (preserveInvalid) query.andWhere("is_valid", "=", true);
  const res = await query;
  if (res > 0)
    logger.verbose(`[pruneOldBundles] removed ${res} records for bundles older than ${dateToString(threshold)}`);
}
