/**
 * Singleton broker instance against 0G Galileo testnet, plus helpers for the
 * one-time ledger init, provider acknowledgement, and provider sub-account
 * funding. Same wallet is reused across calls - costs are real OG, so we do
 * NOT re-pay on every decide().
 */
import { ethers } from "ethers";
import { createRequire } from "node:module";
import type { ZGComputeNetworkBroker } from "@0gfoundation/0g-compute-ts-sdk";

// The published ESM bundle of @0gfoundation/0g-compute-ts-sdk@0.8.4 ships with
// Rollup re-export chunks that tsx 4.22's ESM loader chokes on (single-letter
// alias re-exports). Plain `node` resolves fine. Using createRequire here pulls
// the CJS path (`lib.commonjs/index.js`) regardless of the runtime ESM loader,
// which sidesteps the upstream bug without changing the rest of our ESM stack.
const requireSdk = createRequire(import.meta.url);
const { createZGComputeNetworkBroker } = requireSdk("@0gfoundation/0g-compute-ts-sdk") as {
  createZGComputeNetworkBroker: (
    signer: ethers.Wallet,
  ) => Promise<ZGComputeNetworkBroker>;
};

let _broker: ZGComputeNetworkBroker | null = null;
let _signer: ethers.Wallet | null = null;

export function getSigner(): ethers.Wallet {
  if (_signer) return _signer;
  const rpc = process.env.GALILEO_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
  const pk = process.env.PRIMARY_PRIVATE_KEY;
  if (!pk || pk === "0x" || pk.length < 20) {
    throw new Error(
      "PRIMARY_PRIVATE_KEY missing or empty. Set it in .env (Phase 0 wallet, consolidated balance ≥ 5 OG).",
    );
  }
  const provider = new ethers.JsonRpcProvider(rpc);
  _signer = new ethers.Wallet(pk, provider);
  return _signer;
}

export async function getBroker(): Promise<ZGComputeNetworkBroker> {
  if (_broker) return _broker;
  _broker = await createZGComputeNetworkBroker(getSigner());
  return _broker;
}

/**
 * Idempotent: create a ledger if none exists. Default 3 OG matches the v0.6.x
 * contract minimum documented in the official 0g-compute-ts-starter-kit
 * README: "Minimum 3 OG required (contract requirement)". Override only via
 * ZG_LEDGER_INITIAL_OG if a future SDK version relaxes this - anything < 3 OG
 * will revert against the current InferenceServing contract.
 */
export async function ensureLedger(): Promise<void> {
  const broker = await getBroker();
  try {
    await broker.ledger.getLedger();
    // already initialised
  } catch (_err) {
    const ledgerOg = Number(process.env.ZG_LEDGER_INITIAL_OG ?? "3");
    console.log(`[zg-broker] addLedger(${ledgerOg}) - first init, costs ${ledgerOg} OG`);
    await broker.ledger.addLedger(ledgerOg);
  }
}

/** Pick a TeeML-verifiable provider from listService(). */
export async function pickTeeProvider(): Promise<string> {
  const broker = await getBroker();
  const services = await broker.inference.listService();
  // services schema: { provider, verifiability, model?, ... } per ServiceStructOutput
  const tee = services.find(
    (s: { verifiability?: string; provider: string }) => s.verifiability === "TeeML",
  );
  if (!tee) {
    throw new Error(
      "No TeeML-verifiable provider available on 0G Galileo. Try again in a few minutes - testnet provider set is dynamic.",
    );
  }
  console.log(`[zg-broker] picked TeeML provider: ${tee.provider}`);
  return tee.provider;
}

/** One-time per provider: acknowledge signer + fund 1 OG sub-account. Idempotent. */
export async function ensureProviderFunded(providerAddress: string): Promise<void> {
  const broker = await getBroker();

  // 1. acknowledge signer (idempotent - sdk checks contract state internally)
  try {
    const acked = await broker.inference.acknowledged(providerAddress);
    if (!acked) {
      console.log(`[zg-broker] acknowledgeProviderSigner(${providerAddress.slice(0, 10)}…)`);
      await broker.inference.acknowledgeProviderSigner(providerAddress);
    }
  } catch (e) {
    // older SDKs may not have `acknowledged` - fall back to attempting acknowledge
    console.log(`[zg-broker] acknowledge fallback: ${(e as Error).message}`);
    try {
      await broker.inference.acknowledgeProviderSigner(providerAddress);
    } catch {
      /* already acknowledged */
    }
  }

  // 2. transfer to provider sub-account (idempotent - top-up if needed).
  // Default 1 OG matches the starter-kit canonical pattern.
  const providerFundOg = process.env.ZG_PROVIDER_FUND_OG ?? "1.0";
  const providerFundWei = ethers.parseEther(providerFundOg);
  const minRequiredWei = providerFundWei / 2n;
  try {
    const providers = await broker.ledger.getProvidersWithBalance("inference");
    const row = providers.find(([addr]) => addr.toLowerCase() === providerAddress.toLowerCase());
    const currentBalance = row?.[1] ?? 0n;
    if (currentBalance < minRequiredWei) {
      console.log(
        `[zg-broker] transferFund(${providerAddress.slice(0, 10)}…, 'inference', ${providerFundOg} OG) - current ${ethers.formatEther(currentBalance)}`,
      );
      await broker.ledger.transferFund(providerAddress, "inference", providerFundWei);
    }
  } catch (e) {
    // last resort: just transferFund; if already funded, sdk should error or be a no-op
    console.log(`[zg-broker] transferFund fallback: ${(e as Error).message}`);
    try {
      await broker.ledger.transferFund(providerAddress, "inference", providerFundWei);
    } catch (e2: unknown) {
      const msg = String((e2 as Error)?.message ?? "");
      if (!msg.toLowerCase().includes("balance") && !msg.toLowerCase().includes("already")) {
        throw e2;
      }
    }
  }
}
