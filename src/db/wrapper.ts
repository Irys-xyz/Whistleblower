import logger from "@logger";
import { type Knex } from "knex";

export function wrapKnex(knex: Knex): void {
  const queries = new Map<
    string,
    { sql: string; start: number; cleanup: NodeJS.Timeout; queryContext?: { timeout?: number; name?: string } }
  >();

  knex.on("query", (query) => {
    const uid = query.__knexQueryUid;
    query.start = performance.now();
    const cleanup = setTimeout(() => {
      const q = queries.get(uid);
      if (q) {
        logger.warn(`Expiring query ${q.sql}`);
      }
    }, 100_000);
    query.cleanup = cleanup;
    queries.set(uid, query);
  });

  knex.on("query-response", (_response, query): void => {
    const uid = query.__knexQueryUid;
    const q = queries.get(uid);
    if (!q) return void logger.warn(`unable to find query with ID ${uid}`);
    clearTimeout(q.cleanup);
    const duration = performance.now() - q.start;
    const alertTimeout = q.queryContext?.timeout ?? 2_000;
    const durationStr = duration.toFixed(3);
    const str = q?.queryContext?.name ?? q.sql;
    if (duration > alertTimeout) logger.warn(`[DB] query ${str} took too long! (${durationStr} > ${alertTimeout})`);
    logger.debug(`[DB] query ${str} took ${durationStr}ms`);
  });
}
