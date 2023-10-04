export type Alert = TxAlert; /* | BundleAlert; */

// export enum BundleAlertCodes {
//   PROCESS_STREAM_ERROR,
//   VERIFY_ATTEMPTS_EXHAUSTED,
// }

export enum TransactionAlertCodes {
  UNABLE_TO_LOCATE_PARENT_BUNDLE,
  INVALID_PARENT_BUNDLE,
  INVALID,
}

type AlertBase = {
  reason: string;
  info: { id: string; [k: string]: any };
};

export type TxAlert = {
  type: "transaction";
  code: TransactionAlertCodes;
} & AlertBase;

/* export type BundleAlert = {
  type: "bundle";
  code: BundleAlertCodes;
} & AlertBase; */
