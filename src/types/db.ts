/* eslint-disable @typescript-eslint/naming-convention */

export type Transactions = {
  tx_id: string;
  is_valid: number | boolean | undefined;
  bundled_in: string | undefined | null;
  date_verified: Date | number | undefined;
  deadline_height: number;
  date_created: number | Date;
};

export type Bundles = {
  tx_id: string;
  block: number;
  is_valid: number | boolean | undefined;
  date_verified: Date | number | undefined;
  date_created: Date | number | undefined;
  nested: boolean;
  from_node: string | undefined;
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
