import type { ReceiptStore } from "@agentcheckout/shared/store";
import { getVouchState } from "./zg";

/**
 * For Next.js API routes, prefer the in-memory Vouch store
 * (process-wide singleton via globalThis). Kept as a function for parity
 * with the donor API; callers don't care about the implementation.
 */
export function getStore(): ReceiptStore {
  return getVouchState().store;
}
