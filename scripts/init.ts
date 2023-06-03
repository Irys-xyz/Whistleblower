#!/usr/bin/env node
// Note: DO NOT REMOVE/ALTER THE ABOVE LINE - it is called a 'shebang' and is vital for CLI execution.
process.env.LOG_LEVEL = "error";
import { crawlForPeers } from "@/jobs/peers";
import database from "@/db/sqlite";
import { Command } from "commander";
import migrateConfig from "../knexfile";
import { addBundler } from "@utils/bundler";
export const program = new Command();

program.requiredOption("-n --nodes [bundler node URLs...]", "specify node URLs to monitor");
// program.option("--reset", "Reset the nodes database");
program.addHelpText("beforeAll", "This script is used to configure whistleblower");
program.showHelpAfterError();

const argv = process.argv;
program.parse(argv);

(async function (): Promise<void> {
  const options = program.opts();
  const nodes: string[] = options.nodes;
  const status = await database.migrate.currentVersion(migrateConfig.migrations).catch((_) => "none");
  if (status === "none") {
    console.log("Initialisating database...");
    await database.migrate.latest(migrateConfig.migrations);
  }
  const peersSync = crawlForPeers(0);

  console.log(`Adding ${nodes.length} bundler nodes`);
  for (const node of nodes) {
    try {
      await addBundler(new URL(node));
    } catch (e) {
      throw new Error(`Error adding node ${node} - ${e} `);
    }
  }
  console.log("adding peers...");
  await peersSync;
  console.log(
    "Initialisation complete!\nStart your node by running the `start` package.json script or directly via `node ./build/src/bin/Whistleblower.js`",
  );
})()
  .then((_) => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
