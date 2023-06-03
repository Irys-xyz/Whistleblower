import { crawlForPeers } from "@/jobs/peers";
import { fmtError } from "@utils";

(async function () {
  await crawlForPeers();
})()
  .then((_) => process.exit(0))
  .catch((e) => {
    console.error(fmtError(e));
    process.exit(1);
  });
