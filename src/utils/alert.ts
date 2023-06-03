import logger from "@logger";
import { alertFunction } from "./env";

export async function alert(alert: Alert): Promise<void> {
  try {
    await alertFunction(alert);
  } catch (e) {
    logger.error(`[alert] Failed to trigger alert function with alert ${JSON.stringify(alert)} - ${e}`);
  }
}

export type Alert = TxAlert | BundleAlert;

type AlertBase = {
  reason: string;
  info: { id: string; [k: string]: any };
};

export type TxAlert = {
  type: "transaction";
} & AlertBase;

export type BundleAlert = {
  type: "bundle";
} & AlertBase;
