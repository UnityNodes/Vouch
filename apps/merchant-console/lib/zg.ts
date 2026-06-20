/**
 * Process-wide Vouch state for the hosted demo. One MockZGComputeClient
 * + one in-memory ReceiptStore live here; both /api routes share them.
 *
 * In a real prod deployment you'd swap the in-memory store for a SQLite or
 * KV-backed adapter so receipts survive restarts; for the tournament demo,
 * a soft-reset on container restart is acceptable (and a useful "clear" UX).
 */
import type { ReceiptRecord } from "@agentcheckout/shared";
import { MockZGComputeClient, type ZGComputeClient } from "@agentcheckout/zerogravity";

class MemoryStore {
  private receipts: ReceiptRecord[] = [];
  async append(r: ReceiptRecord): Promise<void> {
    this.receipts.unshift(r);
    if (this.receipts.length > 500) this.receipts.length = 500;
  }
  async list(): Promise<ReceiptRecord[]> {
    return this.receipts.slice(0, 200);
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __vouch_state__: { zg: ZGComputeClient; store: MemoryStore } | undefined;
}

export function getVouchState() {
  if (!globalThis.__vouch_state__) {
    globalThis.__vouch_state__ = {
      zg: new MockZGComputeClient(),
      store: new MemoryStore(),
    };
  }
  return globalThis.__vouch_state__;
}
