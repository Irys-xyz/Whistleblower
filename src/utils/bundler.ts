import { type Bundlers } from "@/types/db";
import { arweave } from "./arweave";
import { retryRequest } from "./axios";
import database from "@db/sqlite";

export async function getPublicKey(url: URL): Promise<string> {
  return (await retryRequest(new URL("/public", url))).data;
}

export async function addBundler(url: URL): Promise<void> {
  const pubKey = await getPublicKey(url);
  const address = await arweave.wallets.ownerToAddress(pubKey);
  await database<Bundlers>("bundlers").insert({ url: url.toString(), address }).onConflict("url").ignore();
}
