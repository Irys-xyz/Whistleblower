import { fmtError } from "@utils";
import { addBundler } from "@utils/bundler";

// adds a bundler node
(async function (): Promise<void> {
  const url = process.argv[2];
  if (!url) throw new Error(`positional argument url required`);
  await addBundler(new URL(url));
  console.log(`Added bundler node ${new URL(url).toString()}`);
})()
  .then((_) => process.exit(0))
  .catch((e) => {
    console.error(fmtError(e));
    process.exit(1);
  });
