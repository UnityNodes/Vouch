import { MONAD_TESTNET } from "@agentcheckout/shared";
import type { ChainAtokenConfig } from "../types";

/** Stable non-crypto hash for deterministic mock attributes. */
export function addrHash(addr: string): number {
  let h = 2166136261 >>> 0;
  const s = addr.toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function short(s: string): string {
  return s.replace(/^0x/, "").slice(0, 8);
}

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export function twoLetters(n: number): string {
  // Use abs + division (not signed bit-shift, which can produce negative indices
  // for uint32 values > 2^31 and yield undefined chars).
  const m = Math.abs(Math.trunc(n));
  return ALPHA[m % 26]! + ALPHA[Math.floor(m / 26) % 26]!;
}

/** Static snapshot of Monad config so the mock never needs the network. */
export const MOCK_MONAD_CONFIG: ChainAtokenConfig = {
  chain: MONAD_TESTNET.slug,
  chainId: MONAD_TESTNET.chainId,
  rpcUrl: MONAD_TESTNET.defaultRpcUrl,
  explorer: MONAD_TESTNET.explorerUrl,
  apassAddress: MONAD_TESTNET.contracts.apass,
  accesscoreAddress: MONAD_TESTNET.contracts.accessCore,
  tokens: [
    {
      symbol: "ausdc",
      aSymbol: "ausdc",
      address: MONAD_TESTNET.contracts.aUSDC,
      decimals: 6,
      category: "atoken",
      accessCore: MONAD_TESTNET.contracts.accessCore,
      depositGateway: MONAD_TESTNET.contracts.depositGateway,
    },
    {
      symbol: "usdc",
      address: MONAD_TESTNET.contracts.usdc,
      decimals: 6,
      category: "token",
    },
  ],
};
