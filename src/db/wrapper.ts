import logger from "@logger";
import { DEBUG } from "@utils/env";
import { type Knex } from "knex";

// database.client

export function wrapKnex(knex: Knex): void {
  const queries = new Map<
    string,
    { sql: string; start: number; cleanup: NodeJS.Timer; queryContext?: { timeout?: number; name?: string } }
  >();
  //   const originalRunner = knex.client.runner;
  //   const x = inspect(originalRunner);
  //   knex.client.runner = (builder: any): any => {
  //     // const then = performance.now();
  //     // const r = await originalRunner(builder)
  //     const r = originalRunner(builder);
  //     return r;
  //   };
  //   knex.client.runner = knex.client.runner.bind(knex.client);

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
    if (duration > alertTimeout) logger.warn(`query ${str} took too long! (${durationStr} > ${alertTimeout})`);
    if (DEBUG) logger.debug(`query ${str} took ${durationStr}ms`);
  });
}
