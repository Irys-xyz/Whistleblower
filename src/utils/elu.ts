import logger from "@logger";
import { performance } from "perf_hooks";

let lastELU = performance.eventLoopUtilization();

export const ELUInterval = setInterval(() => {
  // Store the current ELU so it can be assigned later.
  const tmpELU = performance.eventLoopUtilization();
  // Calculate the diff between the current and last before sending.
  const ELU = performance.eventLoopUtilization(tmpELU, lastELU);
  //   console.log(ELU.utilization);
  if (ELU.utilization >= 0.9)
    logger.warn(
      `[ELU] Event loop utilisation high (${ELU.utilization}) - please reduce configured concurrency values!`,
    );
  // Assign over the last value to report the next interval.
  lastELU = tmpELU;
}, 1_000);
