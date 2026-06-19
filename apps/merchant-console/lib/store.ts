import path from "node:path";
import { JsonReceiptStore } from "@agentcheckout/shared/store";

/** Shared receipts file at the monorepo root .data (written by demo-merchant). */
export function getStore() {
  const p = process.env.RECEIPTS_PATH ?? path.resolve(process.cwd(), "..", "..", ".data", "receipts.json");
  return new JsonReceiptStore(p);
}
