/**
 * Upload a small JSON value to 0G Storage and return its durable root hash.
 *
 * Used by the hosted explorer in live mode to persist each decision record on
 * 0G Storage, so the "On-chain receipt" can point at a real, content-addressed
 * proof. Loaded lazily (see loadSdk) so importing the package barrel in mock
 * mode never requires the optional 0G storage SDK.
 */
import { ethers } from "ethers";
import { createRequire } from "node:module";
import type { Indexer as IndexerType, MemData as MemDataType } from "@0gfoundation/0g-storage-ts-sdk";

const requireSdk = createRequire(import.meta.url);
type StorageSdk = { Indexer: typeof IndexerType; MemData: typeof MemDataType };
let sdk: StorageSdk | undefined;
function loadSdk(): StorageSdk {
  if (!sdk) {
    sdk = requireSdk("@0gfoundation/0g-storage-ts-sdk") as StorageSdk;
  }
  return sdk;
}

const DEFAULT_INDEXER = "https://indexer-storage-testnet-turbo.0g.ai";

export interface StorageUploadResult {
  storageRoot: string;
  uploadTxHash?: string;
}

export async function uploadJsonToStorage(value: unknown): Promise<StorageUploadResult> {
  const { Indexer, MemData } = loadSdk();

  const rpcUrl = process.env.GALILEO_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
  const indexerUrl = process.env.ZG_STORAGE_INDEXER ?? DEFAULT_INDEXER;
  const pk = process.env.PRIMARY_PRIVATE_KEY;
  if (!pk || pk === "0x" || pk.length < 20) {
    throw new Error("PRIMARY_PRIVATE_KEY required for 0G Storage uploads");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(pk, provider);
  const indexer = new Indexer(indexerUrl);

  const blob = Buffer.from(JSON.stringify(value), "utf8");
  const file = new MemData(blob);

  // SDK signature: upload(file, blockchain_rpc, signer) returns [result, error]
  const [result, err] = await indexer.upload(file, rpcUrl, signer);
  if (err) {
    throw new Error(`0G Storage upload failed: ${err.message}`);
  }

  const storageRoot =
    "rootHash" in result ? result.rootHash : (result.rootHashes?.[0] ?? "");
  const uploadTxHash =
    "txHash" in result ? result.txHash : (result.txHashes?.[0] ?? "");

  return { storageRoot, uploadTxHash };
}
