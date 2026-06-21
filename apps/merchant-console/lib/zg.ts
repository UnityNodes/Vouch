/**
 * Process-wide Vouch state for the hosted demo.
 *
 * Mode is driven by ZG_COMPUTE_MODE:
 *   - "live": a real 0G Compute TEE client (makeZGComputeClient("live")), built
 *     once per process. Broker init (addLedger/transferFund) is idempotent, so
 *     re-creating here does not re-spend OG.
 *   - anything else: the deterministic MockZGComputeClient.
 *
 * Robustness: if live init throws (provider down, RPC hiccup), we fall back to
 * mock for that request and clear the cached init so a later request retries
 * live. The receipt store is shared across live and fallback so the feed stays
 * coherent. A soft-reset on container restart is acceptable for the demo.
 */
import type { ReceiptRecord } from "@agentcheckout/shared";
import {
  MockZGComputeClient,
  makeZGComputeClient,
  type ZGComputeClient,
} from "@agentcheckout/zerogravity";

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

export type VouchMode = "live" | "mock";
export interface VouchState {
  zg: ZGComputeClient;
  store: MemoryStore;
  mode: VouchMode;
}

declare global {
  // eslint-disable-next-line no-var
  var __vouch_store__: MemoryStore | undefined;
  // eslint-disable-next-line no-var
  var __vouch_mock__: MockZGComputeClient | undefined;
  // eslint-disable-next-line no-var
  var __vouch_live__: ZGComputeClient | undefined;
  // eslint-disable-next-line no-var
  var __vouch_live_init__: Promise<ZGComputeClient | null> | undefined;
}

function store(): MemoryStore {
  if (!globalThis.__vouch_store__) globalThis.__vouch_store__ = new MemoryStore();
  return globalThis.__vouch_store__;
}

function mock(): MockZGComputeClient {
  if (!globalThis.__vouch_mock__) globalThis.__vouch_mock__ = new MockZGComputeClient();
  return globalThis.__vouch_mock__;
}

export async function getVouchState(): Promise<VouchState> {
  const wantLive = process.env.ZG_COMPUTE_MODE === "live";

  if (wantLive) {
    if (globalThis.__vouch_live__) {
      return { zg: globalThis.__vouch_live__, store: store(), mode: "live" };
    }
    if (!globalThis.__vouch_live_init__) {
      globalThis.__vouch_live_init__ = makeZGComputeClient("live")
        .then((c) => {
          globalThis.__vouch_live__ = c;
          console.log("[vouch] live 0G Compute client ready");
          return c;
        })
        .catch((e) => {
          console.error("[vouch] live init failed, serving mock until retry:", (e as Error).message);
          globalThis.__vouch_live_init__ = undefined; // allow a later request to retry live
          return null;
        });
    }
    const live = await globalThis.__vouch_live_init__;
    if (live) return { zg: live, store: store(), mode: "live" };
  }

  return { zg: mock(), store: store(), mode: "mock" };
}
