import { crawlForPeers } from "@/jobs/peers";
import database from "@/db/sqlite";
import { Command } from "commander";
import migrateConfig from "../../knexfile";
import { addBundler } from "@utils/bundler";
export const program = new Command();

program.addHelpText("beforeAll", "This CLI is used to configure and manage Whistleblower");
program.showHelpAfterError();

// const options = program.opts();

program
  .command("init")
  .description("Initialize Whistleblower with a set of bundler nodes.")
  //   .argument("<nodes>", "bundler node(s) to add (in full URL form)")
  .requiredOption("-n --nodes [bundler node URLs...]", "specify node URLs to monitor")
  .action(async (opts) => {
    const nodes: string[] = opts.nodes;
    const status = await database.migrate.currentVersion(migrateConfig.migrations).catch((_) => "none");
    if (status === "none") {
      console.log("Initialisating database...");
      await database.migrate.latest(migrateConfig.migrations);
    }
    const peersSync = crawlForPeers(0);

    console.log(`Adding ${nodes.length} bundler nodes...`);
    for (const node of nodes) {
      try {
        await addBundler(new URL(node));
      } catch (e) {
        throw new Error(`Error adding node ${node} - ${e} `);
      }
    }
    console.log("Adding peers...");
    await peersSync;
    console.log(
      "Initialisation complete!\nStart your node by running the `start` package.json script or directly via `node ./build/src/bin/Whistleblower.js`",
    );
    return;
  });

const isScript = require.main === module;
if (isScript) {
  (async function (): Promise<void> {
    const argv = process.argv;
    await program.parseAsync(argv);
  })()
    .then((_) => {
      process.exit(0);
    })
    .catch((e) => {
      console.log(e);
      process.exit(1);
    });
}
