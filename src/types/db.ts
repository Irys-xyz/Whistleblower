/* eslint-disable @typescript-eslint/naming-convention */

export type Transactions = {
  tx_id: string;
  is_valid: number | boolean | undefined;
  bundled_in: string | undefined | null;
  date_last_verified: Date | number | undefined;
  deadline_height: number;
  date_created: number | Date;
};

export type Bundles = {
  tx_id: string;
  block: number;
  is_valid: number | boolean | undefined;
  date_last_verified: Date | number | undefined;
  nested: boolean;
  date_created: Date | number | undefined;
  from_node: string | undefined;
  verify_attempts: number;
};

export type Peers = {
  url: string;
  trust: number;
  date_created: Date | number;
  last_praised: Date | number | undefined;
};

export type Bundlers = {
  // name: string;
  url: string;
  address: string;
  // ar_public_key: string;
};

declare module "knex/types/tables" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Tables {
    transactions: Transactions;
    bundles: Bundles;
    peers: Peers;
    bundlers: Bundlers;
  }
}
