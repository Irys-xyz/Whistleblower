import logger from "@logger";
import { alertFunction } from "./env";
import { type Alert } from "@/types/alert";

export async function alert(alert: Alert): Promise<void> {
  try {
    await alertFunction(alert);
  } catch (e) {
    logger.error(`[alert] Failed to trigger alert function with alert ${JSON.stringify(alert)} - ${e}`);
  }
}
