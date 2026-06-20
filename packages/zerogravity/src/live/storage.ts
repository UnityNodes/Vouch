/**
 * 0G Storage adapter for the existing ReceiptStore interface.
 *
 * Uploads each receipt as a tiny JSON blob to the 0G Storage network via the
 * Indexer. The returned rootHash is the durable, verifiable pointer; we cache
 * the records in memory so the live feed renders without round-trips for the
 * group-stage demo. Production would either re-download from Storage or
 * mirror to a fast index.
 */
import { ethers } from "ethers";
import { createRequire } from "node:module";
import type { Indexer as IndexerType, MemData as MemDataType } from "@0gfoundation/0g-storage-ts-sdk";
import type { ReceiptStore } from "@agentcheckout/shared/store";
import type { ReceiptRecord } from "@agentcheckout/shared";

// Same Rollup-chunk re-export issue as the compute SDK - load via CJS to
// dodge tsx's ESM resolution bug.
const requireSdk = createRequire(import.meta.url);
const { Indexer, MemData } = requireSdk("@0gfoundation/0g-storage-ts-sdk") as {
  Indexer: typeof IndexerType;
  MemData: typeof MemDataType;
};

const DEFAULT_INDEXER = "https://indexer-storage-testnet-turbo.0g.ai";

export class ZGStorageReceiptStore implements ReceiptStore {
  private readonly indexer: IndexerType;
  private readonly signer: ethers.Wallet;
  private readonly rpcUrl: string;
  private readonly cache: ReceiptRecord[] = [];

  constructor() {
    const rpcUrl = process.env.GALILEO_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
    const indexerUrl = process.env.ZG_STORAGE_INDEXER ?? DEFAULT_INDEXER;
    const pk = process.env.PRIMARY_PRIVATE_KEY;
    if (!pk || pk === "0x" || pk.length < 20) {
      throw new Error(
        "PRIMARY_PRIVATE_KEY missing - required for 0G Storage uploads. Falling back to JsonReceiptStore is recommended for local dev.",
      );
    }
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    this.signer = new ethers.Wallet(pk, provider);
    this.rpcUrl = rpcUrl;
    this.indexer = new Indexer(indexerUrl);
  }

  async append(r: ReceiptRecord): Promise<void> {
    const blob = Buffer.from(JSON.stringify(r), "utf8");
    const file = new MemData(blob);

    // SDK signature: upload(file, blockchain_rpc, signer) → [result, error]
    const [result, err] = await this.indexer.upload(file, this.rpcUrl, this.signer);
    if (err) {
      throw new Error(`0G Storage upload failed: ${err.message}`);
    }
    const rootHash =
      "rootHash" in result ? result.rootHash : (result.rootHashes?.[0] ?? "");
    const txHash =
      "txHash" in result ? result.txHash : (result.txHashes?.[0] ?? "");

    const stored: ReceiptRecord = {
      ...r,
      // Stash the root hash on the receipt - the shared schema has no slot, so
      // we tuck it into the resource URL fragment for the live feed UI.
      // Phase 4 will extend ReceiptRecord with first-class storageRoot/txHash.
      resource: `${r.resource}#zgs:${rootHash}`,
    };
    this.cache.unshift(stored);
    if (this.cache.length > 500) this.cache.length = 500;

    // log so demo viewers see the pointer
    console.log(
      `[zg-storage] receipt ${r.id} → root ${rootHash.slice(0, 12)}… (tx ${txHash.slice(0, 12)}…)`,
    );
  }

  async list(): Promise<ReceiptRecord[]> {
    return this.cache.slice(0, 200);
  }
}
