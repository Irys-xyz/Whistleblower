/* eslint-disable @typescript-eslint/naming-convention */
export type Tag = { name: string; value: string };

export type SignedReceiptBody = {
  id: string;
  timestamp: number;
  version: "1.0.0";
  public: string;
  signature: string;
  deadlineHeight: number;
  validatorSignatures: [];
};

export type Transaction = {
  id: string;
  owner: string;
  owner_address: string;
  signature: string;
  target: string;
  tags: Tag[];
  data_size: number;
  parent?: string;
};

export type BundleInfo = {
  id: string;
  block: number;
  owner: string;
};
